# Verification — v51 regional reorder simulator

Release `2026.10.12-reorder-simulator51`; changed-asset cache version `20261012-4`. Complete source update; no remote publication was performed.

**415 checks passed with zero failures across fourteen suites.**

| Suite | Passed |
| --- | ---: |
| workflows | 23 |
| interface | 51 |
| mk-ai | 24 |
| mk-space | 14 |
| production | 27 |
| fulfillment | 49 |
| fulfillment-sql | 10 |
| mk-region | 15 |
| customer-orders | 34 |
| resilience | 41 |
| enterprise-layout | 34 |
| portfolio | 33 |
| login-entry | 14 |
| reorder-simulator | 46 |

The 46 simulator checks verify arrival-adjusted coverage, negative net-stock backlog, buffer and optional inbound, finite/whole-number validation, complete-month sales evidence, same-region and exact-model matching, monotonic/reproducible probability and pre-arrival stockout risk. Source-driven control checks cover manual entry in all three regions, read-only records, working sales-store reads, missing/blocked history, source refresh races and recovery, duplicate inventory identities, model drafts, report/default quantity buttons, real brand lead-time saving, retired Analysis routes and responsive/accessibility declarations.

All 91 pages pass separate working, demo and corrupt-record recovery startup audits. There are no runtime errors, duplicate IDs, unlabeled active controls or stuck loading states. Retired redirects are checked separately. The main login form, explicit guest demo and existing operations remain covered by their original regression suites.

Static inspection passes 189 syntax checks and 2,266 local HTML/CSS references. All 281 v50 source files are retained. Official regional inventory/sales, stock reconciliation, reservations, working fulfillment and receiving calculation sections match v50 exactly. Server and backend migration files remain unchanged.

The build contains 91 HTML pages and 89 fingerprinted JS/CSS assets. Root `.nojekyll` is empty. No custom `.github/workflows` or root `pages.yml` is included; publishing remains Deploy from a branch, main / root.

## Method and practical limits

Checks use Node.js/jsdom, pure planning math, synthetic monthly sales and stock, emulated standard UI APIs, mocked authentication/transport, isolated PostgreSQL and byte/static/build inspection. They do not establish graphical desktop/mobile rendering, real sign-in, live inference, carrier/partner requests, live database migrations or deployment. A bootstrap estimate from fictional or uploaded history is not evidence of calibrated future accuracy; the interface displays its conditional assumptions and refuses to invent a probability when history is insufficient.

Commit the extracted complete source to the publishing branch to update the public site, then verify the published VERSION.json, login/demo, regional manual input and real browser/mobile behavior. See [DEPLOY_FROM_BRANCH.md](../DEPLOY_FROM_BRANCH.md) and [REORDER_SIMULATOR.md](REORDER_SIMULATOR.md).

Current evidence is `verification-release-20261012-v51.json`, the fourteen suite reports, three all-page reports, `verification-static.json` and `source-manifest-v51.json`. Earlier v50/v49/v48/v47 release reports remain historical evidence.
