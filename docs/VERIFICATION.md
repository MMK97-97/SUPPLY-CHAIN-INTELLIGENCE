# Verification — MK Intelligence 4.2, 2026-10-07

Release: `2026.10.07-unified-enterprise-production42`. Shared source asset version: `20261007-1`. The primary deployment target is the existing Cloudflare Workers website. GitHub Pages branch deployment remains supported.

## Results

- **126 regression checks passed with zero failures:** 23 business-workflow checks, 38 interface/DOM checks, 24 local/retained-private-service analyst checks, 14 Space transport checks and 27 production checks.
- **149 JavaScript and inline-script syntax checks passed.** All **1,350 local references across 77 HTML pages** resolved. All 73 shared pages use the revised asset version. Early loading/navigation boot runs on 76 shared or authentication pages.
- Navigation checks cover immediate native links, retained current-page visibility, modified clicks, downloads and external links, cancelled navigation, back/forward draft restoration, bounded intent prefetch, sensitive URLs, offline/slow connections and reduced motion. The conflicting fade/delay handlers were removed.
- The Cloudflare build produced 77 pages and 71 fingerprinted JavaScript/CSS assets. Checks verified source/content hashes, nested links, release metadata, Worker cache behavior, extensionless and directory routes, HEAD requests and missing-page responses. The build excludes backend source and verification files from public assets.
- Startup simulations passed for 14 source or built pages, including regional reports, Sales Analysis, Events, Shipment Tracking, the root dashboard and a nested CRM module. These checks use jsdom and do not render a browser.
- Authentication checks cover parallel local dependency loading, protected-content gating, pending membership timeouts, visible failure states, readiness of sign-in controls and prevention of native form submission before the client is ready. Safe-output checks reject active HTML, dangerous links and resource-loading elements in legacy cloud responses.
- Local workbook round-trip checks preserved model leading zeros, quantities and dates using the pinned SheetJS 0.20.3 build. Authentication, chart, workbook and formatting libraries are bundled with their licenses and provenance in `vendor-dependencies.json`.
- **Ten business/report engines retain their exact prior-package hashes.** Regional inventory, shared records, enterprise workflows, logistics, sales analysis, report normalization and calculation-tool formulas were preserved. The cancelled order-management/3PL specification revision was not added.
- Root `index.html`, empty `.nojekyll`, no custom `.github/workflows` and no root `pages.yml` were verified. GitHub Pages compatibility remains **Deploy from a branch → main → / (root)**.

## Live AI and cross-origin checks

The shipped website connector completed a public `website_chat` inference against `MMK97/supply-ai-chain-hub` using synthetic Cozy Earth test facts only. The answer correctly reported 304 eligible on-hand units, 20 units of monthly demand, 26 recommended replenishment units and one model with a stockout flag. It separated the discontinued test model, cited references present in the supplied context, described confidence as an 80/100 score and did not ask for an unavailable website tool. These quantities are test values, not the user's actual inventory.

The revised `MK verified website facts v2` context passes completed calculations rather than exposing local tool names as callable model tools. Tests include older conversation turns mentioning unavailable tools, valid bounded JSON, privacy boundaries, explicit coverage limits, regional currency handling, invalid output, source-reference checks, provider failures, SSE completion, cancellation and timeouts. The legacy Worker proxy accepts the same exact JSON/SSE contract.

Public HTTP checks verified OPTIONS, POST and SSE responses allow `https://supply-chain-intelligence.manoj-k-manne.workers.dev`. The POST/SSE cross-origin validation used an empty-message rejection and did not send business reports or start inference. The separate live brand inference used synthetic facts and completed in approximately 59 seconds; this is provider response time, not page-navigation timing.

Machine-readable current reports: `verification-workflows.json`, `verification-interface.json`, `verification-mk-ai.json`, `verification-mk-space.json`, `verification-production.json`, `verification-static.json`, `verification-mk-space-live-20261007.json` and `verification-release-20261007.json`. Earlier live and deployment reports remain as historical evidence. The inspected Space schema is in `mk-space-contract.json`.

## Verification limits and deployment

Automated source tests use Node.js, jsdom and mocked Worker/authentication/cloud services. Browser preview was denied earlier in the session. Actual desktop/mobile rendering and page-transition timing remain unverified. The DOM simulations do not demonstrate a measured browser performance improvement. Live sign-in/membership, database migrations/RLS, Deno execution and live business transactions remain unverified.

This revised website has not been deployed to the user's account or committed to the repository. Space files/secrets and the live Supabase database/functions were not changed. No vendor dispatch, business message or financial transaction was performed. The optional private cloud backend is retained source, not a newly deployed enterprise service.

Use `DEPLOY_TO_WORKERS.md` for the primary target: run `node build-cloudflare.mjs`, then `npx wrangler deploy` with the existing account. The source ZIP excludes generated `dist`; build it before deployment. For GitHub Pages, use `DEPLOY_FROM_BRANCH.md`.

AI context is limited to 16,000 characters with bounded relevant excerpts and explicit coverage limits. Reference checks establish that cited IDs were supplied, not that every inference is correct. Website facts, AI prose and local planning suggestions remain distinct. Monitoring runs while a page is open; automatic AI briefings are optional. Stop cancels the website transport, while already submitted inference may finish on the Space server. Review recommendations before acting.
