# Security

Use GitHub's private vulnerability reporting for this repository, or contact the maintainer privately. Include the affected version and enough detail to reproduce the issue on the synthetic fixture. Keep credentials and database contents out of reports.

## Ask the Data

- Keep a separate synthetic database for the demo. Use a fresh database and run `backend/ask_readonly.sql` there. Give the API's Ask connection the `ask_reader` credentials and keep administrator credentials out of `ASK_DATABASE_URL`.
- The executor checks the active role and read-only transaction, uses column-level SELECT grants and a PostgreSQL statement timeout of three seconds, resolves unqualified functions through `pg_catalog`, and queries a canonical SELECT against `ONLY public.compounds`.
- Keep the public API behind its configured edge. Vercel supplies the client address through `x-vercel-forwarded-for`. Other deployments can set `ASK_PROXY_IP_HEADER` with `ASK_TRUSTED_PROXY_IPS` for a trusted peer that overwrites that header. When using application-level proxy handling, disable Uvicorn's automatic proxy-header handling.
- Configure `CORS_ORIGINS` for the intended frontend origin. Local development can explicitly allow its own origin. Keep Redis and provider credentials in the host's secret store. Use a distinct Redis namespace for each environment and set `ASK_ENABLED=false` to pause the feature.
