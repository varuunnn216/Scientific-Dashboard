import pytest

from ask.sql import UnsafeSQL, validate

INVALID = [
    "", " ", "nonsense", "SELECT", "SELECT FROM", "SELECT 1", "SELECT () FROM compounds",
    "SELECT * FROM compounds;;", "SELECT * FROM compounds; SELECT * FROM compounds",
    "SELECT * FROM compounds; DELETE FROM compounds", "SELECT * FROM compounds; SET ROLE NONE",
    "-- comment\nSELECT * FROM compounds", "SELECT /* comment */ * FROM compounds",
    "SELECT * FROM compounds -- end", "SELECT * FROM compounds /* outer /* inner */ end */",
    "SeLeCt * FrOm Pg_ClAsS", "SELECT * FROM \"Compounds\"", "ＳＥＬＥＣＴ * FROM compounds",
    "SELECT * FROM compоunds", "SELECT\u200b * FROM compounds", "SELECT * FROM compounds\x00",
    "SELECT * FROM compounds\x1b", "SELECT * FROM pg_catalog.pg_class",
    "SELECT * FROM information_schema.tables", "SELECT * FROM public.compounds",
    "SELECT * FROM private_fixture", "SELECT ctid FROM compounds", "SELECT xmin FROM compounds",
    "SELECT unknown FROM compounds", "SELECT other.name FROM compounds",
    "SELECT * FROM compounds ORDER BY mystery", "SELECT * FROM compounds GROUP BY missing",
    "SELECT * FROM compounds HAVING max(secret) > 0", "SELECT count(secret) FROM compounds",
    "SELECT pg_sleep(1) FROM compounds", "SELECT pg_read_file('x') FROM compounds",
    "SELECT dblink('x', 'y') FROM compounds", "SELECT current_setting('x') FROM compounds",
    "SELECT pg_catalog.abs(id) FROM compounds", "SELECT unnest(ARRAY[1]) FROM compounds",
    "SELECT set_config('x', 'y', true) FROM compounds", "SELECT random() FROM compounds",
    "SELECT name::regclass FROM compounds", "SELECT id::public.custom FROM compounds",
    "SELECT id::numeric(1000, 2) FROM compounds", "SELECT id::int[] FROM compounds",
    "INSERT INTO compounds (name) VALUES ('x')", "UPDATE compounds SET name = 'x'",
    "DELETE FROM compounds", "DROP TABLE compounds", "ALTER TABLE compounds ADD COLUMN x int",
    "CREATE TABLE x (id int)", "TRUNCATE compounds", "GRANT SELECT ON compounds TO public",
    "COPY compounds TO STDOUT", "CALL x()", "SET search_path = public", "EXECUTE prepared",
    "SELECT * INTO TEMP copy FROM compounds", "SELECT * FROM compounds FOR UPDATE",
    "EXPLAIN SELECT * FROM compounds", "SELECT * FROM ONLY pg_catalog.pg_class",
    "SELECT * FROM compounds, private_fixture", "SELECT a.id FROM compounds a JOIN compounds b USING (id)",
    "SELECT * FROM (SELECT * FROM compounds) s", "SELECT (SELECT 1) FROM compounds",
    "SELECT * FROM compounds WHERE EXISTS (SELECT 1)", "SELECT id FROM compounds UNION SELECT id FROM compounds",
    "WITH x AS (DELETE FROM compounds RETURNING id) SELECT id FROM x",
    "WITH RECURSIVE x AS (SELECT id FROM compounds) SELECT id FROM x",
    "WITH compounds AS (SELECT id FROM private_fixture) SELECT id FROM compounds",
    "WITH x AS (SELECT id FROM compounds) SELECT category FROM x",
    "WITH x AS (SELECT id FROM compounds), y AS (SELECT id FROM x) SELECT id FROM y",
    "SELECT * FROM compounds LIMIT -1", "SELECT * FROM compounds LIMIT ALL",
    "SELECT * FROM compounds LIMIT 2 + 2", "SELECT * FROM compounds LIMIT (SELECT 2)",
    "SELECT * FROM compounds OFFSET 10001", "SELECT * FROM compounds ORDER BY id FETCH FIRST 2 ROWS WITH TIES",
    "SELECT count(*) OVER () FROM compounds", "SELECT count(*) FILTER (WHERE id > 0) FROM compounds",
    "SELECT * FROM compounds TABLESAMPLE SYSTEM(50)", "SELECT DISTINCT ON (id) id FROM compounds",
    "SELECT * FROM compounds c(other)", "SELECT * FROM compounds WHERE id OPERATOR(public.=) 1",
    "SELECT * FROM compounds ORDER BY id USING OPERATOR(public.<)",
    "SELECT " + "(" * 1500 + "1" + ")" * 1500 + " FROM compounds",
]


@pytest.mark.parametrize("sql", INVALID)
def test_rejects_unsupported_sql(sql):
    with pytest.raises(UnsafeSQL):
        validate(sql)


@pytest.mark.parametrize("sql", [
    "SELECT * FROM compounds",
    "SELECT category, COUNT(*) AS n FROM compounds GROUP BY category ORDER BY n DESC;",
    "SELECT id FROM compounds WHERE id BETWEEN 2 AND 4",
    "SELECT name FROM compounds WHERE category IN ('Antiviral', 'Antifungal')",
    "SELECT c.id FROM compounds AS c WHERE c.name ILIKE 'cmp-%'",
    "SELECT id FROM compounds WHERE name = ';--/*'",
    "SELECT round(avg(molecular_weight)::numeric, 2) FROM compounds",
    "WITH best AS (SELECT binding_affinity FROM compounds ORDER BY binding_affinity LIMIT 8) SELECT avg(binding_affinity) FROM best",
])
def test_accepts_expected_queries(sql):
    shown, probe = validate(sql)
    assert "public.compounds" in shown
    assert "LIMIT 200" in shown
    assert "LIMIT 201" in probe


@pytest.mark.parametrize("limit, shown, internal", [(201, 200, 201), (200, 200, 200), (3, 3, 3), (0, 0, 0)])
def test_limit(limit, shown, internal):
    sql, probe = validate(f"SELECT id FROM compounds LIMIT {limit}")
    assert sql.endswith(f"LIMIT {shown}")
    assert probe.endswith(f"LIMIT {internal}")
