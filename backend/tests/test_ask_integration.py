from contextlib import closing
import os
from pathlib import Path
from uuid import uuid4

import psycopg2
import pytest
import redis

from ask.db import execute
from ask.limits import Limits
from ask.sql import validate


def test_read_only_role(monkeypatch):
    owner_dsn = os.getenv("ASK_TEST_OWNER_DSN")
    if not owner_dsn:
        pytest.skip("Set ASK_TEST_OWNER_DSN to a fresh, disposable PostgreSQL database.")
    reader_dsn = psycopg2.extensions.make_dsn(owner_dsn, user="ask_reader")
    script = Path(__file__).resolve().parents[1] / "ask_readonly.sql"
    with closing(psycopg2.connect(owner_dsn)) as owner, owner, owner.cursor() as cursor:
        cursor.execute("CREATE TABLE public.compounds (id integer); INSERT INTO public.compounds VALUES (1)")
        cursor.execute("CREATE TABLE public.private_fixture (id integer)")
        cursor.execute(script.read_text())

    monkeypatch.setenv("ASK_DATABASE_URL", reader_dsn)
    assert execute(*validate("SELECT id FROM compounds")) == (["id"], [(1,)], False)
    with closing(psycopg2.connect(reader_dsn)) as reader:
        reader.autocommit = True
        with reader.cursor() as cursor:
            cursor.execute("SHOW default_transaction_read_only")
            assert cursor.fetchone() == ("on",)
            cursor.execute("SET default_transaction_read_only = off")
            for sql in ("INSERT INTO public.compounds VALUES (2)", "SELECT * FROM public.private_fixture"):
                with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                    cursor.execute(sql)


def test_shared_limits(monkeypatch):
    url = os.getenv("ASK_TEST_REDIS_URL")
    if not url:
        pytest.skip("Set ASK_TEST_REDIS_URL to a disposable Redis instance.")
    monkeypatch.setenv("ASK_REDIS_NAMESPACE", f"pytest-{uuid4()}")
    monkeypatch.setenv("ASK_PER_IP_MINUTE", "1")
    monkeypatch.setenv("ASK_PER_IP_DAY", "2")
    monkeypatch.setenv("ASK_GLOBAL_DAY", "2")
    clock = [60]
    monkeypatch.setattr("ask.limits.time.time", lambda: clock[0])
    first = Limits(redis.Redis.from_url(url))
    second = Limits(redis.Redis.from_url(url))
    assert first.allow("a")
    assert not second.allow("a")
    clock[0] += 60
    assert second.allow("a")
    assert not first.allow("b")
    clock[0] += 86400
    assert first.allow("b")
    assert first.cached("test") is None
    first.cache("test", "result")
    assert second.cached("test") == b"result"
