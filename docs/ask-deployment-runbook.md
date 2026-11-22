# Ask the Data deployment runbook

Planning only. Begin execution after `APPROVED: deploy`. Any change to existing
production compound data requires separate `APPROVED: prod-data`. The owner
performs the cloud console steps.

1. **Identify the Vercel projects and record rollback targets.** The public
   [FastAPI API](https://scientific-dashboard-api.vercel.app/) returned its
   application health response with a Vercel server header on November 22,
   2026. The [dashboard](https://scientific-dashboard-ui.vercel.app/) is the
   frontend origin. In Vercel, match each alias under **Settings → Domains**
   to its project before editing either project. Record the current production
   deployment ID for each and confirm the backend serves the intended
   FastAPI entry point. The review branch disables automatic Vercel
   deployment. Schedule an explicitly approved release commit with the owner.

2. **Provision an isolated PostgreSQL database.** Choose a fresh database
   dedicated to Ask and restrict access to its owner and the application
   login. The validator names `ONLY public.compounds`, so create
   `public.compounds` in that database using the application schema. Verify
   the approved column list and types. As the source owner, export only
   `id`, `name`, `molecular_formula`, `molecular_weight`, `solubility`,
   `toxicity_score`, `binding_affinity`, `category`, and `created_at` from a
   read-only transaction. Use client-side `psql \copy` or the provider's
   export/import flow to transfer the reviewed data into the isolated
   database. Compare row count, distinct names and IDs, and totals by category
   before granting access. Keep any temporary export private and dispose of it
   according to your data policy. If the explorer already runs against a
   database dedicated to this same reviewed public dataset, its underlying
   `public.compounds` can be referenced in place after the owner verifies it
   meets the isolation requirements and the grants below will leave existing
   clients working. The default plan is a copy into a separate database.

3. **Create and verify the application login.** Run
   `psql -v ON_ERROR_STOP=1 -f backend/ask_readonly.sql` from the repo root
   using a secure connection configured for the isolated database owner.
   The script creates the login, grants the nine columns, pins
   `search_path` to `pg_catalog`, and sets read-only defaults and a
   statement timeout. It also revokes broad PUBLIC table, schema creation,
   and database TEMP privileges. Use the script only in the isolated
   database. If the role already exists on the same cluster, have the DBA
   review and apply the statements after role creation to the existing
   role, with explicit database access reviewed. Create the login
   credential in the database console and store the connection securely.
   Test a fresh login as `ask_reader`. Run `SHOW search_path` and
   `SHOW default_transaction_read_only`, then read the nine columns.
   In an isolated test database, verify that writes, ordinary and temporary
   table creation, unlisted columns, and unrelated tables are denied even
   after the session default is switched to read-write.

4. **Create a TLS Redis instance.** In Upstash Console, go to **Redis →
   Create Database**, choose the region near the API, and select the Free
   plan. In database details, use the TLS Redis protocol connection
   information for `ASK_REDIS_URL`. Verify connectivity and Lua support
   from the deployment environment. Use a separate database or namespace
   for validation. Check the plan's command, connection, and storage
   limits before enabling traffic. [Upstash setup](https://upstash.com/docs/redis/overall/getstarted)
   · [Upstash plans](https://upstash.com/pricing/redis)

5. **Set provider guardrails in the consoles.** Start with a dedicated
   project or key for the feature. Record the model's account-specific
   request and token limits and the owner-approved monthly budget.
   - **Groq.** Open the organization Limits page and check request and token
     quotas. On paid plans, use **Settings → Billing → Limits** to set the
     monthly organization spending cap and alerts. Keep the free plan's
     built-in quotas if no paid budget is approved.
     [Rate limits](https://console.groq.com/docs/rate-limits) · [Spend controls](https://console.groq.com/docs/spend-limits)
   - **Gemini.** Use a new restricted key for the selected AI Studio project.
     Revoke the previously exposed key. Open the project's **Rate limits**
     and **Spend** views. Check request and token quotas and configure a
     monthly project spend cap where the billing tier supports it.
     [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) · [Billing](https://ai.google.dev/gemini-api/docs/billing)
   - **Cerebras.** Review project Limits and organization Billing in Cerebras
     Cloud Console. Set project request and token limits where supported.
     Review trial credits and turn off paid replenishment unless funded
     usage is approved. Keep Cerebras out of provider order until one
     model and JSON-mode smoke call succeeds with its project credential.
     [Rate limits](https://inference-docs.cerebras.ai/support/rate-limits)
   - Base the app quotas on the smallest enabled provider's limits, with
     room for retries and repair. Each uncached request can make two provider
     calls. The Redis quotas are application guardrails, and the provider
     consoles govern account spending.

6. **Enter Vercel settings while Ask is paused.** In the backend project's
   **Settings → Environment Variables**, select the intended deployment
   environment and add the variables below by name. Store credentials
   as sensitive values. Give `CORS_ORIGINS` the exact frontend origin.
   Start with `ASK_ENABLED` set to false. Leave the explorer's existing
   database configuration in place. In the frontend project, check the
   existing `VITE_API_URL` points at the intended API alias.

   | Purpose | Variable names |
   | --- | --- |
   | Role connection, TLS Redis, namespace | `ASK_DATABASE_URL`, `ASK_REDIS_URL`, `ASK_REDIS_NAMESPACE` |
   | Origin and kill switch | `CORS_ORIGINS`, `ASK_ENABLED` |
   | Per-IP minute and day, global day | `ASK_PER_IP_MINUTE`, `ASK_PER_IP_DAY`, `ASK_GLOBAL_DAY` |
   | Provider order and timeout | `LLM_PROVIDER_ORDER`, `LLM_TIMEOUT_SECONDS` |
   | Enabled provider keys | `GROQ_API_KEY`, `GEMINI_API_KEY`, `CEREBRAS_API_KEY` |
   | Enabled provider models | `LLM_GROQ_MODEL`, `LLM_GEMINI_MODEL`, `LLM_CEREBRAS_MODEL` |

7. **Validate, then enable.** Build the approved release with Ask paused
   first. Verify the explorer and that Ask returns HTTP 503 with status
   `paused`. Exercise quota and dependency-failure tests on an isolated
   deployment with the same code and separate Redis and database configuration
   before opening public traffic. Enable Ask only after these gates pass,
   deploy the approved configuration, and run the following smoke checks
   against the production URL. Keep disruptive production quota and outage
   tests confined to a controlled window and disposable Redis namespace or
   instance, with the owner restoring the intended settings afterwards.

   | Check | Procedure and expected result |
   | --- | --- |
   | Six example chips | Run all six from the live page. Compare rows to the hand-written SQL in `evals/chips.jsonl` against the same reviewed snapshot. Confirm the strongest-binders order, formatted SQL, both grouped charts, and the binding-affinity caption. |
   | Five attack prompts | Use the five existing held-out attack cases in `evals/cases.jsonl`. Verify refusal or rejection with no query result rows. |
   | Minute quota | With day quotas above the minute quota in a disposable namespace, repeat the same harmless request from one client in a single UTC minute. The first request beyond the cap returns HTTP 429 with status `capacity`. |
   | Daily quotas | With a fresh namespace and minute quota above the test daily quota, exceed the per-IP daily limit first. Then reset the test namespace and set global daily below per-IP daily to exercise the global cap separately. Each returns HTTP 429. Restore the planned limits and namespace before public traffic. |
   | Kill switch | Set `ASK_ENABLED` false and deploy the configuration. Verify HTTP 503 with status `paused`. Restore the approved enabled setting after the check. |
   | Redis unavailable | Interrupt only the disposable Redis dependency, or point the isolated deployment at a verified unavailable TLS endpoint. Verify HTTP 503 and a friendly temporary-unavailability message. Confirm no provider-call increase. Restore the good configuration and repeat a successful query. |
   | CORS | Send an OPTIONS preflight with an unlisted Origin and a requested POST method. Expect no `Access-Control-Allow-Origin` grant. Repeat from the exact frontend origin and confirm it is granted. |
   | Response and browser review | Inspect response bodies for the smoke checks and confirm neither secrets nor stack traces appear. Confirm the production browser console has no application errors during normal use. An intentional rejected request may appear as an HTTP error in DevTools. |

8. **Roll back if a gate fails.** Pause Ask by setting `ASK_ENABLED` false
   and deploying that configuration. If the API fails to boot or the
   explorer regresses, restore the recorded healthy backend deployment and
   restore the corresponding frontend deployment if necessary. Confirm the
   public aliases, dashboard results, and paused or absent Ask route. Keep
   the isolated data for diagnosis and revoke any credential exposed during
   the incident. Reopen the feature only after an approved fix and a fresh
   smoke pass.
