# Verification — v49 portfolio upgrade

Release: `2026.10.12-portfolio-upgrade49`; changed-asset cache version `20261012-2`. The complete source is prepared. No live deployment was performed.

**355 regression checks passed with zero failures across twelve suites.**

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

All 90 HTML pages passed separate working, demo and recovery startup audits. Redirects are inspected separately rather than executed as browser navigation. Audits found no runtime errors, duplicate IDs, unlabeled active inputs or stuck loading state. Source checks passed 183 JavaScript/TypeScript/inline syntax checks and 2,317 local HTML/CSS/redirect references. All 259 v48 source files are retained. The original inventory reorder, sales analysis, stock reconciliation, reservation and working fulfillment/receiving calculation sections match v48 exactly; application store routing and specified correctness fixes are documented separately.

The build contains 90 pages and 85 fingerprinted JS/CSS assets with matching SHA-256 contents. Root `.nojekyll` is empty; no custom `.github/workflows` or root `pages.yml` is included.

The added portfolio checks exercise first-visit demo entry; existing-record preservation; all three regions' order allocation and dispatch; receiving; warehouse picking; digital reward dispatch; simulated 3PL processing; recorded shipment tracking; report/preference/chat isolation; database/channel namespaces; reset safety; report clearing; resolved discrepancies; open inbound PO accuracy; connected-stock scenarios; currency boundaries; missing-cost/stale-source flags; real local analyst conversations; mobile menu/focus controls; inline analyst layout; login demo/password controls; declared text contrast; and optimized image size.

## Method and limits

Tests use Node.js with jsdom 26, synthetic records, emulated viewport APIs, mocked transport and isolated SQL execution. HTML startup and declared CSS properties are checked without graphical rendering. Decorative canvas is emulated as unavailable in the all-page audits. These checks do not verify actual pixels, touch-device layout, real loading latency, production login/recovery, organization policies in the deployed database, live AI inference, carrier/partner service availability or remote publication.

The demo blocks organization synchronization and live business transmission. Demo acknowledgements and tracking are explicit simulations. Local analysis works independently of external AI. Use the published-site checklist in `DEPLOY_FROM_BRANCH.md` before claiming the live site is production-verified.

Machine-readable evidence: `verification-release-20261012-v49.json`, `verification-static.json`, the twelve suite reports and `verification-pages{,-demo,-recovery}.json`. Historical v48/v47 release reports remain historical evidence.
