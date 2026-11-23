import json
import logging

from fastapi.responses import JSONResponse

from .limits import client_address, get_limits
from .providers import ProviderSession
from .service import UNAVAILABLE, ask

logger = logging.getLogger(__name__)


def message(status, reason, code):
    return JSONResponse({"status": status, "reason": reason}, status_code=code)


def process(question, request):
    try:
        address = client_address(request)
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


