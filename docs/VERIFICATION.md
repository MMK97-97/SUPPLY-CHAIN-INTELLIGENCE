# Verification — MK Intelligence 4.1, 2026-10-05

MK now connects to `MMK97/supply-ai-chain-hub` through its dedicated `website_chat` JSON API. The Space UI's button handlers and status messages are never used as inference endpoints. The website keeps local report calculations, regional scope, monitoring and clearly labeled fallback. The cancelled order-management/3PL revision remains excluded.

## Results

- **99 workflow/interface/AI checks passed:** 23 shared business-workflow checks, 38 interface/DOM checks, 24 local/retained-private-service analyst checks and 14 new Space integration checks. All reports have zero failures.
- Space checks cover the exact JSON payload, report context, privacy boundaries, valid bounded context, currencies, read-only scenarios, complete conversation pairs, streamed SSE/Unicode/heartbeats, invalid output and provider errors, invented references, access/sleep/rate-limit errors, inference-free connection testing, cancellation/timeouts, actual chat wiring and escaped output.
- **66 JavaScript, TypeScript and inline-script syntax checks passed.** All **1,250 local references across 77 HTML pages** resolved. All **73 shared pages** load the Space connector before MKAI with asset version `20261005-5`.
- Eight business/report engines and the optional business-cloud adapter retain their exact prior source hashes. Regional inventory, orders, warehouse and logistics data schemas were not changed by this integration.
- Root `index.html`, empty `.nojekyll`, no custom `.github/workflows` and no root `pages.yml` were verified. Publishing remains **Deploy from a branch → main → / (root)**.
- **Live public API checks passed:** the Space was running, its JSON schema matched, and HTTP OPTIONS/POST/SSE responses allowed the GitHub Pages origin. A synthetic 38-unit test returned the expected quantity and source citation. The actual shipped JavaScript connector separately checked the endpoint and returned the correct synthetic TEST-00001 model, 21-unit quantity and `[US:item:0]` citation in Fast mode.

Machine-readable reports: `verification-workflows.json`, `verification-interface.json`, `verification-mk-ai.json`, `verification-mk-space.json`, `verification-mk-space-live.json`, `verification-static.json` and `verification-branch.json`. The inspected Space schema is in `mk-space-contract.json`. Reproduction commands and the separate jsdom dependency are described in README.md and MK_AI_SETUP.md.

## Verification limits

Automated source tests use Node.js and jsdom DOM simulations with mocked HTTP, authentication and cloud services. They do not render a browser. Browser preview was denied earlier in the session, so actual desktop/mobile rendering remains unverified. The DOM simulation supplies Node scheduling for the local ZIP reader because jsdom does not reproduce browser postMessage scheduling.

Live tests used public HTTP APIs and synthetic, nonpersonal report facts only. The website has not been committed or published to GitHub. Pages settings, Space files/secrets and the live Supabase database/functions were not modified. No vendor dispatch, business message or financial transaction was performed. The retained private OpenAI/Supabase service was not deployed; its SQL execution, RLS, Deno runtime and live authentication remain unverified and are not needed for the current public Space connector.

Report facts reflect the current browser workspace. AI context is limited to 16,000 characters and uses bounded relevant excerpts with full report summaries and explicit coverage limits. Reference checks confirm cited IDs were sent, not every model inference. AI prose, calculated website facts and local planning suggestions are labeled separately. Monitoring operates while a page is open; automatic AI briefings are optional. Stop cancels the website transport, while already submitted inference may finish on the Space server. Future Space uptime, model access and inference capacity can change.
