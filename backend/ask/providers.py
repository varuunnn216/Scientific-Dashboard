import os
import time
from dataclasses import dataclass
from functools import lru_cache

import httpx

ENDPOINTS = {
    "groq": ("https://api.groq.com/openai/v1", "openai/gpt-oss-20b", "low"),
    "cerebras": ("https://api.cerebras.ai/v1", "qwen-3.8-27b", "none"),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai", "gemini-3.5-flash-lite", None),
}
MAX_OUTPUT_TOKENS = 500


@dataclass(frozen=True)
class Provider:
    name: str
    url: str
    model: str
    effort: str | None
    key: str


@lru_cache(maxsize=1)
def configured():
    providers = []
    for item in dict.fromkeys(os.getenv("LLM_PROVIDER_ORDER", "groq,gemini,cerebras").split(",")):
        name = item.strip().lower()
        if name not in ENDPOINTS or not os.getenv(f"{name.upper()}_API_KEY"):
            continue
        url, model, effort = ENDPOINTS[name]
        providers.append(Provider(
            name, url, os.getenv(f"LLM_{name.upper()}_MODEL") or model,
            os.getenv(f"LLM_{name.upper()}_REASONING_EFFORT") or effort,
            os.environ[f"{name.upper()}_API_KEY"],
        ))
    return tuple(providers)


def retry_delay(value):
    try:
        return min(max(float(value), 0.25), 2)
    except (TypeError, ValueError):
        return 0.5


class ProviderSession:
    """Count every outgoing HTTP attempt against the same two-call budget."""

    def __init__(self, providers=None, before_call=None, after_call=None, cooldown=None, client=None):
        self.providers = configured() if providers is None else providers
        self.before_call = before_call
        self.after_call = after_call
        self.cooldown = cooldown
        self.client = client or httpx.Client(
            timeout=float(os.getenv("LLM_TIMEOUT_SECONDS") or "8"), trust_env=False,
        )
        self.calls = 0
        self.tokens = 0
        self.model = None
        self.provider = None

    def complete(self, messages):
        order = [p for p in self.providers if not self.cooldown or not self.cooldown.get(p.name)]
        if self.provider:
            order.sort(key=lambda p: p.name != self.provider)
        while order and self.calls < 2:
            provider = order.pop(0)
            reservation = self.before_call(provider, messages) if self.before_call else None
            self.calls += 1
            self.model = provider.model
            self.provider = provider.name
            body = {
                "model": provider.model, "messages": messages, "temperature": 0,
                "max_completion_tokens": MAX_OUTPUT_TOKENS,
                "response_format": {"type": "json_object"},
            }
            if provider.effort:
                body["reasoning_effort"] = provider.effort
            try:
                response = self.client.post(
                    f"{provider.url}/chat/completions", json=body,
                    headers={"Authorization": f"Bearer {provider.key}"},
                )
            except httpx.RequestError:
                continue
            if response.is_success:
                try:
                    payload = response.json()
                    used = payload.get("usage", {}).get("total_tokens")
                    if isinstance(used, int) and used >= 0:
                        self.tokens += used
                        if self.after_call:
                            self.after_call(provider, reservation, used)
                    return payload["choices"][0]["message"]["content"]
                except (TypeError, ValueError, KeyError, AttributeError, IndexError):
                    return None
            code = response.status_code
            if code == 400:
                try:
                    if response.json().get("error", {}).get("code") == "json_validate_failed":
                        return None
                except (AttributeError, ValueError):
                    pass
            if code == 429 and self.is_daily_limit(response):
                if self.cooldown:
                    self.cooldown.set(provider.name, 86400)
                continue
            if code == 429 or 500 <= code < 600:
                if self.calls < 2:
                    time.sleep(retry_delay(response.headers.get("retry-after")))
                    if not order:
                        order.append(provider)
                continue
        raise ProviderUnavailable()

    @staticmethod
    def is_daily_limit(response):
        if response.headers.get("x-ratelimit-remaining-requests") == "0":
            return True
        text = response.text[:4096].lower()
        return any(marker in text for marker in ("per day", "perday", "daily quota", "daily limit", "requests/day"))

    def close(self):
        self.client.close()


class ProviderUnavailable(Exception):
    pass
