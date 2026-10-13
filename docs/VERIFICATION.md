# Verification — v52 saved reports and workspace navigation

Release `2026.10.13-workspace-fixes52`; changed-asset cache version `20261013-1`. Complete source update; no remote publication was performed.

**433 checks passed with zero failures across fifteen suites.**

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
| workspace-fixes | 18 |

The 18 new checks cover saved-panel mounting and actual Excel workbook generation in US/EU/Canada, duplicate manual saves, existing working database names, demo isolation, legacy Canada records, 30-record retention, transaction aborts and prevention of raw-data replacement when archiving fails. They also verify organization/demo return paths, rejected unsafe destinations, late legacy navigation cleanup, modal/AI layout styles and duplicate asset loading.

Existing login checks use a mocked authentication client to verify successful and failed sign-in, organization membership and safe returns. The 46 simulator checks retain regional coverage and probability math verification. Operational suites cover order validation/dispatch, procurement receipt, 3PL, digital fulfillment, regional isolation, failure recovery and SQL behavior.

All 91 pages pass separate working, demo and corrupt-record recovery startup audits. There are no runtime errors, duplicate IDs, unlabeled active controls or stuck loading states in those source-driven audits. Redirects are checked separately.

Static inspection passes 191 syntax checks and 2,430 local HTML/CSS references. All 289 v51 source files are retained. Official regional inventory/sales, stock reconciliation, reservation, working fulfillment and receiving calculation sections match v51 exactly. Server and backend migration files remain unchanged.

The build contains 91 HTML pages and 91 fingerprinted JS/CSS assets. Root `.nojekyll` is empty. No custom `.github/workflows` or root `pages.yml` is included. Publishing remains Deploy from a branch, main / root.

## Cloud-browser findings

On October 13, the live Reorder Report showed no saved history, the old Analysis Report link and top AI button, and an inline workspace dialog. Its organization option reached a login form but did not preserve the current module. No credentials were submitted.

Read-only repository inspection found newer root-level JavaScript/CSS copies while the actual `assets/` folder still contained earlier code. In particular, `assets/system-shell.js` contains the old Analysis Report entry, AI header button and index.html home target. Pages request assets from that folder, so flattened root uploads cannot update them. The observed main commit was `09555e9`. The cloud browser was signed out of GitHub; no repository write was made.

The official managed preview was attempted and stopped after a container mount-permission failure. Corrected graphical desktop/mobile rendering remains unverified. The corrected source has only source-driven layout evidence so far. The public VERSION.json navigation was blocked by the browser client; a live release identifier was not established from that URL.

## Practical limits

Checks use Node.js/jsdom, a transaction-faithful synthetic IndexedDB fixture, actual Excel workbook serialization and reading, synthetic operational/monthly-sales data, mocked authentication/transport, isolated PostgreSQL and byte/static/build inspection. They do not establish real organization sign-in, cross-device history synchronization, external inference, carrier/partner requests or remote deployment. Browser history remains specific to the original browser, workspace and origin.

Publish every extracted file to its correct relative path, then check the corrected desktop/mobile UI and actual organization login on the published site. See [DEPLOY_FROM_BRANCH.md](../DEPLOY_FROM_BRANCH.md) and [WORKSPACE_FIXES.md](WORKSPACE_FIXES.md).

Current evidence is `verification-release-20261013-v52.json`, the fifteen suite reports, three all-page reports, `verification-static.json` and `source-manifest-v52.json`. Earlier release reports remain historical evidence.
