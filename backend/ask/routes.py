import json
import os

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from starlette.requests import ClientDisconnect


router = APIRouter()


def enabled() -> bool:
    return os.getenv("ASK_ENABLED") == "true"


@router.get("/api/ask/status")
def ask_status():
    return JSONResponse({"enabled": enabled()}, headers={"Cache-Control": "no-store"})


def invalid_question(status_code):
    return JSONResponse(
        {"status": "error", "reason": "Enter a question of up to 300 characters."},
        status_code=status_code,
    )


@router.post("/api/ask")
async def query_compounds(request: Request):
    if not enabled():
        return JSONResponse(
            {"status": "paused", "reason": "Ask the Data is paused. It will return soon."},
            status_code=503,
        )
    try:
        body = bytearray()
        async for chunk in request.stream():
            if len(body) + len(chunk) > 4096:
                return invalid_question(413)
            body.extend(chunk)
        data = json.loads(body)
        question = data.get("question") if isinstance(data, dict) else None
        if not isinstance(question, str) or not question.strip() or len(question) > 300:
            raise ValueError
        question.encode("utf-8")
    except (ValueError, RecursionError, ClientDisconnect):
        return invalid_question(400)
    from .runtime import process

    return await run_in_threadpool(process, question.strip(), request)
