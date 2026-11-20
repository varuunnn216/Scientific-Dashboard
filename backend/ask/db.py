import os
from contextlib import closing
from functools import lru_cache

import psycopg2

from .sql import ROW_CAP


@lru_cache(maxsize=1)
def database_url():
    return os.environ["ASK_DATABASE_URL"]


def execute(sql, probe):
    with closing(psycopg2.connect(database_url(), connect_timeout=3, options=(
        "-c statement_timeout=3000 -c lock_timeout=1000 -c search_path=pg_catalog -c standard_conforming_strings=on -c timezone=UTC"
    ))) as connection:
        connection.set_session(readonly=True)
        with connection, connection.cursor() as cursor:
            cursor.execute("SELECT current_user, current_setting('transaction_read_only')")
            if cursor.fetchone() != ("ask_reader", "on"):
                raise ValueError("An isolated read-only role is required.")
            cursor.execute(probe)
            columns = [column.name for column in cursor.description]
            rows = cursor.fetchmany(ROW_CAP + 1)
            return columns, rows[:ROW_CAP], len(rows) > ROW_CAP
