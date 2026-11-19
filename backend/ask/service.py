import json
import time

import psycopg2
from fastapi.encoders import jsonable_encoder

from .db import execute
from .prompt import messages
from .providers import ProviderUnavailable
from .sql import UnsafeSQL, validate

REFUSAL_REASON = ("This demo can answer clear questions about the synthetic compounds. "
                  "Try asking about a category, property, or comparison.")
FAILURE = "We couldn't run that question. Try a simpler question about the compounds."
UNAVAILABLE = "Ask the Data is temporarily unavailable. Try again in a moment."


def unique_object(pairs):
    fields = dict(pairs)
    if len(fields) != len(pairs):
        raise ValueError("Duplicate response fields")
    return fields


def parse_response(content):
    if not isinstance(content, str) or len(content) > 6000:
        raise ValueError("Return a single JSON object.")
    result = json.loads(content, object_pairs_hook=unique_object)
    if not isinstance(result, dict):
        raise ValueError("Return a single JSON object.")
    if result.get("status") == "refuse" and set(result) == {"status", "reason"}:
        if isinstance(result["reason"], str) and 0 < len(result["reason"].strip()) <= 600:
            return result
    if result.get("status") == "ok" and set(result) == {"status", "sql", "explanation"}:
        if all(isinstance(result[key], str) and result[key].strip() for key in ("sql", "explanation")):
            if len(result["explanation"]) <= 600 and result["explanation"].isascii():
                return result
    raise ValueError("Return the specified JSON fields.")


def ask(question, provider, execute_query=execute):
    start = time.monotonic()
    correction = None
    failure_kind = "agent"
    valid_sql = False
    repaired = False

    def response(status, **fields):
        return {
            "status": status, "sql": None, "explanation": None, "columns": [],
            "rows": [], "row_count": 0, "truncated": False,
            "latency_ms": round((time.monotonic() - start) * 1000),
            "model": provider.model, "tokens": provider.tokens,
            "model_calls": provider.calls, "provider": provider.provider,
            "repaired": repaired,
            "valid_sql": valid_sql, **fields,
        }

    for _ in range(2):
        if provider.calls >= 2:
            break
        previous_calls = provider.calls
        try:
            content = provider.complete(messages(question, correction))
        except ProviderUnavailable:
            repaired = correction is not None and provider.calls > previous_calls
            return response("error", reason=UNAVAILABLE, failure_kind="infra")
        repaired = correction is not None and provider.calls > previous_calls
        try:
            decision = parse_response(content)
        except (ValueError, RecursionError):
            correction = "Return valid JSON with the required fields."
            continue
        if decision["status"] == "refuse":
            return response("refuse", reason=REFUSAL_REASON)
        try:
            sql, probe = validate(decision["sql"])
        except UnsafeSQL as error:
            correction = str(error)
            continue
        valid_sql = True
        try:
            columns, rows, truncated = execute_query(sql, probe)
            return response(
                "ok", sql=sql, explanation=decision["explanation"], columns=columns,
                rows=jsonable_encoder(rows), row_count=len(rows), truncated=truncated,
            )
        except psycopg2.Error as error:
            code = error.pgcode or ""
            failure_kind = "infra" if not code or code in {"57014", "55P03"} else "agent"
            correction = {
                "42883": "Use compatible function argument types.",
                "42803": "Group by every selected non-aggregated column.",
                "42703": "Use only known column names.",
                "57014": "The query exceeded its time limit; simplify it.",
            }.get(code, "The database could not run that query. Use a simpler SELECT.")
        except (KeyError, ValueError):
            return response("error", reason=UNAVAILABLE, failure_kind="infra")
    return response("error", reason=FAILURE, failure_kind=failure_kind)
