import json
import os
import logging

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from starlette.requests import ClientDisconnect

from .limits import client_address, get_limits
from .providers import ProviderSession
from .service import UNAVAILABLE, ask

router = APIRouter()
logger = logging.getLogger(__name__)


def message(status, reason, code):
    return JSONResponse({"status": status, "reason": reason}, status_code=code)


def process(question, address):
    try:
        limits = get_limits()
        if not limits.allow(address):
            return message("capacity", "Demo capacity is used up for now. Please try again later.", 429)
        cached = limits.cached(question)
        if cached:
            return {**json.loads(cached), "model_calls": 0, "tokens": 0, "repaired": False, "cached": True}
        provider = ProviderSession(cooldown=limits)
        try:
            result = ask(question, provider)
        finally:
            provider.close()
        if result["status"] in {"ok", "refuse"}:
            limits.cache(question, json.dumps(result, allow_nan=False))
        return result
    except Exception as error:
        logger.warning("Ask service request failed (%s)", type(error).__name__)
        return message("error", UNAVAILABLE, 503)


@router.post("/api/ask")
async def query_compounds(request: Request):
    if os.getenv("ASK_ENABLED", "").lower() != "true":
        return message("paused", "Ask the Data is paused. Please check back later.", 503)
    try:
        body = bytearray()
        async for chunk in request.stream():
            if len(body) + len(chunk) > 4096:
                return message("error", "Enter a question of up to 300 characters.", 413)
            body.extend(chunk)
        data = json.loads(body)
        question = data.get("question") if isinstance(data, dict) else None
        if not isinstance(question, str) or not question.strip() or len(question) > 300:
            raise ValueError
        question.encode("utf-8")
    except (ValueError, RecursionError, ClientDisconnect):
        return message("error", "Enter a question of up to 300 characters.", 400)
    return await run_in_threadpool(process, question.strip(), client_address(request))
