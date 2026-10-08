# Verification — customer orders and navigation, 2026-10-08

Release: `2026.10.08-unified-enterprise-customer-orders45`. Source cache version: `20261008-3`. The v45 source update is complete and has not been published to the live Workers website or repository. GitHub Pages remains compatible with **Deploy from a branch → main → / (root)**.

## Results

**246 automated checks passed with zero failures.**

| Suite | Passed | Scope |
| --- | ---: | --- |
| Existing business workflows | 23 | Existing orders, allocations, receiving and execution |
| Interface | 51 | Shared navigation, module startup, search, styles and contrast |
| MK AI | 24 | Local report analysis and retained service contract |
| Hugging Face transport | 14 | Response, cancellation and failure handling |
| Production/build | 27 | Startup, native navigation, Worker routes/caches, dependencies and fingerprints |
| Fulfillment | 49 | Order, shipping, 3PL, import, vendor PO, attachment, server API and form workflows |
| SQL migrations | 10 | Isolated PostgreSQL execution and tenant/write/idempotency protections |
| Regional AI | 15 | Route/query regions, history, notes, payloads and late answers |
| Customer orders and navigation | 33 | CRM address snapshots/editor, numbering, carriers/billing, inventory, fulfillment and search placement |

The static audit passed **171 JavaScript, TypeScript and inline script syntax checks**. All **1,459 local references across 90 HTML pages** resolve. There are 85 shared-core pages and 88 pages with early loading/navigation boot; the retired workspace now uses a small dependency-free redirect instead. Changed assets have the current cache version. The Cloudflare build contains **90 pages and 74 fingerprinted assets**, with VERSION.json and the asset manifest.

## New checks

The customer-order tests verify customer PO and internally generated sales order numbers, case-insensitive collision rejection, stable internal numbers on draft edits and atomic invalid-input failures. CRM customer and ship-to addresses are independently snapshotted on orders. Later CRM edits leave saved orders unchanged; missing addresses are not invented. Incomplete and stale address-editor saves are rejected without replacing prior records.

Descriptions resolve from the regional catalog and remain read-only. Tests distinguish overall stock from recorded warehouse locations, choose Farmers Branch from an explicit WMS balance, leave known non-covering multi-line stock unassigned, label the default when warehouse balances are absent and retain a manual override. Automatic selection never creates a partner request or shipment. Existing global reservation/credit checks remain in place.

Every listed carrier and LTL service is exercised through saved orders. Custom account methods remain possible; invalid carrier/service pairs and blank custom methods are rejected. Third-party billing needs account and ZIP together; shipper billing clears unused billing fields and LTL cannot accidentally retain parcel billing. Form tests cover CRM prefills, custom ship-to preservation, number preview, model descriptions/availability, changing carriers/services, manual fulfillment and a complete saved/validated order. New inventory and address text also passes 4.5:1 contrast checks.

The 16 regional banners are absent. The Regional Workspace module is removed while old EU/Canada/US bookmarks redirect safely to their direct reports. Representative CRM, shipping, 3PL, sales, raw report and warehouse pages show no search controls; orders, vendors and procurement retain working search. The old regional workspace AI query case now tests the direct Canada sales route, matching the removed module.

## Retained behavior

All **237 v44 source files remain present**. Sixteen selected calculation, data, logistics, AI and navigation assets retain their exact v44 hashes. In particular, the regional inventory engines, operational state/reservation core, sales calculation code, MK AI and MK Brain are unchanged. The EU AI correction remains covered by all 15 regional regressions. 3PL, Transportation, Shipping and Procurement remain separate modules with the existing shared records.

The existing suites verify draft/issue stock isolation, single allocation, cancellation credit/stock release, multi-line shipment atomicity, shipment import previews/duplicates/stale data, vendor PO receiving, packing-slip backup retention and failed quota writes. Server/provider tests use synthetic adapters and verify exact order payloads, authentication, organization access, bounded transport, durable idempotency and uncertain acknowledgments. Both migrations run in an isolated PGlite PostgreSQL database; this does not establish the state of the user's live database.

The unchanged public Space connector was live-tested October 7 with synthetic brand facts, as recorded in the historical live report. No live inference or business records were sent for v45. Historical v43/v44 release reports remain in the package and describe those earlier snapshots; the current release summary is `verification-release-20261008-v45.json`.

## Evidence and limits

Current machine-readable evidence is in the nine regression reports listed above, `verification-static.json` and `verification-release-20261008-v45.json`. Source tests use Node.js/jsdom, mocked network adapters and an isolated SQL database. Browser preview was denied earlier in the session; desktop/mobile rendering and measured page-transition timing remain unverified. No browser workaround was used. TypeScript syntax checks do not establish Deno semantic compatibility.

No live deployment, repository commit, sign-in, membership lookup, database migration, shipping-label purchase, booking, vendor dispatch, message or partner processing order was performed. Carrier selections record order instructions, not real-time eligibility or rates. Existing inventory/credit validation does not add a separate warehouse reservation ledger. Complete the carrier and local-stock checks before real dispatch using the existing fulfillment workflow.

Use `DEPLOY_TO_WORKERS.md` for the existing Workers target or `DEPLOY_FROM_BRANCH.md` for branch publishing. Root index.html and empty .nojekyll are present, without .github/workflows or root pages.yml. The ZIP includes the complete source, while generated dist, dependencies and verification scratch files are excluded.
