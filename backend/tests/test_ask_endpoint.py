import json

from fastapi.testclient import TestClient
import httpx
import psycopg2
from pglast import parse_sql
from pglast.stream import RawStream
from redis.exceptions import ConnectionError
import pytest

from ask import routes, service
from ask.providers import Provider, ProviderSession
from main import app

OK = {"status": "ok", "sql": "SELECT id FROM compounds LIMIT 1", "explanation": "Selects one ID."}
PROVIDERS = (
    Provider("first", "https://first.test", "first-model", None, "mock"),
    Provider("second", "https://second.test", "second-model", None, "mock"),
)


class FakeLimits:
    def __init__(self):
        self.values = {}
        self.enabled = True
        self.addresses = []
        self.cooldown = {}

    def allow(self, address):
        self.addresses.append(address)
        return self.enabled

    def cached(self, question):
        return self.values.get(question)

    def cache(self, question, value):
        self.values[question] = value

    def get(self, provider):
        return self.cooldown.get(provider)

    def set(self, provider, ttl):
        self.cooldown[provider] = ttl


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv("ASK_ENABLED", "true")
    monkeypatch.delenv("VERCEL", raising=False)
    limits = FakeLimits()
    monkeypatch.setattr(routes, "get_limits", lambda: limits)
    client = TestClient(app)
    sent, outgoing, executed = [], [], []

    def request_handler(request):
        sent.append((request.url.host, json.loads(request.content)))
        outcome = outgoing.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        if isinstance(outcome, httpx.Response):
            return outcome
        content = json.dumps(outcome) if isinstance(outcome, dict) else outcome
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}], "usage": {"total_tokens": 80}})

    def fake_execute(sql, probe):
        executed.append((sql, probe))
        return ["id"], [(142857,)], False

    monkeypatch.setattr(routes, "ProviderSession", lambda **kwargs: ProviderSession(
        PROVIDERS, client=httpx.Client(transport=httpx.MockTransport(request_handler)), **kwargs,
    ))
    monkeypatch.setattr(routes, "ask", lambda q, p: service.ask(q, p, fake_execute))
    return client, limits, sent, outgoing, executed


def send(client, question="List one compound ID", **kwargs):
    return client.post("/api/ask", json={"question": question}, **kwargs)


def test_success_and_cache(setup):
    client, limits, sent, outgoing, executed = setup
    outgoing.append(OK)
    response = send(client, headers={"x-forwarded-for": "198.51.100.3"}).json()
    assert response["status"] == "ok"
    assert response["rows"] == [[142857]] and response["row_count"] == 1 and not response["truncated"]
    assert response["model_calls"] == 1 and response["tokens"] == 80 and not response["repaired"]
    assert "\nFROM ONLY public.compounds" in response["sql"]
    assert RawStream()(parse_sql(response["sql"])) == executed[0][0]
    assert send(client).json()["cached"] is True
    assert len(sent) == len(executed) == 1
    assert limits.addresses == ["unknown", "unknown"]


def test_refusal_is_safe(setup):
    client, _, _, outgoing, executed = setup
    outgoing.append({"status": "refuse", "reason": "internal /private/example"})
    payload = send(client).json()
    assert payload["status"] == "refuse"
    assert "internal" not in payload["reason"]
    assert not executed


@pytest.mark.parametrize("invalid", ["invalid JSON", '{"status":"ok","status":"refuse"}', dict(OK, sql="DROP TABLE compounds")])
def test_repair(setup, invalid):
    client, _, sent, outgoing, executed = setup
    outgoing.extend([invalid, OK])
    result = send(client).json()
    assert result["status"] == "ok"
    assert result["repaired"] and result["model_calls"] == 2 and result["tokens"] == 160
    assert "previous_attempt_error" in sent[1][1]["messages"][1]["content"]
    assert len(executed) == 1


def test_invalid_twice(setup):
    client, _, _, outgoing, executed = setup
    outgoing.extend(["invalid", "invalid"])
    assert send(client).json()["status"] == "error"
    assert not executed


def test_daily_quota_failover_uses_remaining_call(setup):
    client, limits, sent, outgoing, executed = setup
    outgoing.extend([httpx.Response(429, headers={"x-ratelimit-remaining-requests": "0"}), OK])
    payload = send(client).json()
    assert payload["status"] == "ok" and payload["model"] == "second-model"
    assert payload["model_calls"] == 2 and not payload["repaired"]
    assert "first" in limits.cooldown and len(sent) == 2 and len(executed) == 1


def test_network_timeout_recovers_by_failing_over(setup):
    client, _, sent, outgoing, _ = setup
    outgoing.extend([httpx.ReadTimeout("private host"), OK])
    assert send(client).json()["model_calls"] == 2
    assert [host for host, _ in sent] == ["first.test", "second.test"]


def test_db_timeout_does_not_leak_internals(setup, monkeypatch):
    client, _, sent, outgoing, _ = setup
    outgoing.extend([OK, OK])

    def timeout(*_args):
        raise psycopg2.errors.QueryCanceled("private data /private/path")

    monkeypatch.setattr(routes, "ask", lambda q, p: service.ask(q, p, timeout))
    payload = send(client).json()
    assert payload["status"] == "error" and payload["failure_kind"] == "infra" and payload["repaired"]
    assert "/private/path" not in json.dumps(payload) + json.dumps(sent)


def test_provider_failure_is_sanitized(setup):
    client, _, _, outgoing, _ = setup
    outgoing.extend([httpx.Response(503, text="secret value"), httpx.ReadTimeout("private host")])
    payload = send(client).json()
    assert payload["status"] == "error" and payload["failure_kind"] == "infra"
    assert "secret value" not in json.dumps(payload)


def test_capacity_and_kill_switch(setup, monkeypatch):
    client, limits, sent, _, _ = setup
    limits.enabled = False
    response = send(client)
    assert response.status_code == 429 and response.json()["status"] == "capacity"
    monkeypatch.setenv("ASK_ENABLED", "false")
    response = send(client)
    assert response.status_code == 503 and response.json()["status"] == "paused"
    assert not sent


@pytest.mark.parametrize("data", [[], {}, {"question": ""}, {"question": "x" * 301}, {"question": 12}])
def test_rejects_invalid_request(setup, data):
    client, _, sent, _, _ = setup
    response = client.post("/api/ask", json=data)
    assert response.status_code == 400 and not sent


def test_rejects_large_body(setup):
    client, _, sent, _, _ = setup
    response = client.post("/api/ask", content=b"x" * 4097)
    assert response.status_code == 413 and not sent


def test_trusted_proxy(setup, monkeypatch):
    client, limits, _, outgoing, _ = setup
    monkeypatch.setenv("ASK_TRUSTED_PROXY_IPS", "testclient")
    monkeypatch.setenv("ASK_PROXY_IP_HEADER", "x-fixture-client-ip")
    outgoing.append(OK)
    send(client, headers={"x-fixture-client-ip": "198.51.100.13"})
    assert limits.addresses == ["198.51.100.13"]


def test_cors(setup):
    client, *_ = setup
    headers = {"Access-Control-Request-Method": "POST"}
    denied = client.options("/api/ask", headers=dict(headers, Origin="https://example.org"))
    allowed = client.options("/api/ask", headers=dict(headers, Origin="https://scientific-dashboard-ui.vercel.app"))
    assert "access-control-allow-origin" not in denied.headers
    assert allowed.headers["access-control-allow-origin"] == "https://scientific-dashboard-ui.vercel.app"



@pytest.mark.parametrize("operation", ["allow", "cached"])
def test_redis_outage_fails_closed(setup, monkeypatch, operation):
    client, limits, sent, _, executed = setup

    def redis_unavailable(*_args):
        raise ConnectionError("private Redis endpoint")

    monkeypatch.setattr(limits, operation, redis_unavailable)
    response = send(client)
    assert response.status_code == 503
    assert response.json() == {"status": "error", "reason": service.UNAVAILABLE}
    assert not sent and not executed
