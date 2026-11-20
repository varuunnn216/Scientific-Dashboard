-- Run as the owner of an isolated development or preview database seeded
-- exclusively with the repository's synthetic fixture.
-- Set an authentication credential for ask_reader through your DB host.
CREATE ROLE ask_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE ask_reader SET default_transaction_read_only = on;
ALTER ROLE ask_reader SET statement_timeout = '3s';
ALTER ROLE ask_reader SET search_path = pg_catalog;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, ask_reader;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ask_reader;
GRANT SELECT (
    id, name, molecular_formula, molecular_weight, solubility, toxicity_score,
    binding_affinity, category, created_at
) ON TABLE public.compounds TO ask_reader;
