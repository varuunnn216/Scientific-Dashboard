import os
import subprocess
import sys

from fastapi.testclient import TestClient
import pytest

from main import app


@pytest.mark.parametrize("setting", [None, "", "false", "FALSE", "TRUE", "True", " true", "true ", "1", "on"])
def test_only_literal_true_enables_ask(monkeypatch, setting):
    if setting is None:
        monkeypatch.delenv("ASK_ENABLED", raising=False)
    else:
        monkeypatch.setenv("ASK_ENABLED", setting)

    client = TestClient(app)
    assert client.get("/api/ask/status").json() == {"enabled": False}
    response = client.post("/api/ask", content="not even JSON")
    assert response.status_code == 503
    assert response.json() == {
        "status": "paused", "reason": "Ask the Data is paused. It will return soon.",
    }


def test_enabled_status_has_no_dependencies(monkeypatch):
    monkeypatch.setenv("ASK_ENABLED", "true")
    assert TestClient(app).get("/api/ask/status").json() == {"enabled": True}


def test_paused_app_cold_start_never_imports_ask_runtime(tmp_path):
    env = {
        key: value for key, value in os.environ.items()
        if not key.startswith(("ASK_", "LLM_"))
        and key not in {"GROQ_API_KEY", "GEMINI_API_KEY", "CEREBRAS_API_KEY"}
    }
    env["DATABASE_URL"] = f"sqlite:///{tmp_path / 'explorer.sqlite'}"
    subprocess.run([sys.executable, "-c", """
import sys
from importlib.abc import MetaPathFinder

class BlockAskDependencies(MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname.split('.')[0] in {'redis', 'pglast'} or fullname in {
            'ask.runtime', 'ask.limits', 'ask.db', 'ask.providers', 'ask.service', 'ask.prompt',
        }:
            raise AssertionError(f'Unexpected paused import: {fullname}')

sys.meta_path.insert(0, BlockAskDependencies())
from fastapi.testclient import TestClient
from main import app
with TestClient(app) as client:
    assert client.get('/compounds').status_code == 200
    assert client.get('/api/ask/status').json() == {'enabled': False}
    assert client.post('/api/ask', json={'question': 'test'}).status_code == 503
"""], env=env, check=True, capture_output=True)
