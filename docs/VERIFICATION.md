# Verification — production audit, v47

Release: `2026.10.08-unified-enterprise-production-audit47`. Changed shared-script cache version: `20261008-5`. This source release has not been deployed.

## Current automated evidence

**288 regression checks passed with zero failures. All ten suites were rerun against v47.**

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

Separate all-page audits inspected all 90 HTML pages: 79 startup simulations and 11 redirect/source inspections. Normal startup has no captured runtime errors, duplicate IDs, unlabeled active inputs or lingering navigation loading state. The recovery audit also passed all pages, including 76 application recovery screens. Three authentication pages were started with local dependencies; these checks do not sign in or verify a real account.

Static verification passed 173 JavaScript/TypeScript/inline syntax checks and resolved all 1471 inspected local page, script, stylesheet, image, CSS-resource and explicit redirect references. Changed shared scripts have the new cache query. The Cloudflare build contains 90 pages, 74 fingerprinted assets and current VERSION.json/asset-manifest.json. Node syntax parsing is not a Deno semantic check of the optional backend.

## Verified corrections

Failed CRM/customer, vendor and warehouse saves show an inline error, retain input and reload the committed module before retry. Each retry creates one record. Stale edits preserve concurrent committed changes. Invalid required fields and email cannot commit. Shared dialogs have accessible titles, keyboard focus containment/restoration, inline errors and duplicate-submit/edit/dismissal protection while an asynchronous save is pending.

Malformed saved JSON, invalid record/status/currency fields and invalid workspace/report/event groups open a recovery screen without replacing stored records. Recovery retains the original DOM for independent asynchronous report callbacks. Its export contains the original raw stored strings, and export failures display an error. Malformed cross-tab changes are reported and rejected before a transaction callback can run.

Record values are escaped in pricing/catalog, account/program, warehouse and procurement attributes. The synthetic product-code HTML payload no longer creates an injected element; exact SKU values remain available for actions and forms. Upload/vendor/AI controls have accessible labels, and missing decorative canvas context does not prevent agent startup. The actual 3PL routing and receiving buttons were exercised with synthetic records.

## Preserved behavior

All 243 v46 source files remain. 78 frontend assets retain their exact v46 hashes, including inventory engines, sales/reorder calculation assets and MK AI/brain code. Shared reservation calculations, inventory reconciliation and the remaining core business/region-import functions are byte-identical to v46. Existing schema version 1, storage keys, record IDs and SQL/backend sources remain. 3PL and transportation remain separate. v44 EU AI scope, v45 customer-order/CRM flows and v46 address labels pass their current regression suites.

## Scope and limits

The tests use Node.js/jsdom, standard API emulation, synthetic records, mocked transports and isolated PGlite SQL. They do not render pixels or measure desktop/mobile layout or navigation timing. The requested live GitHub Pages URL could not be retrieved by the web reader, so its deployed source/version is not confirmed. Earlier browser preview permission was denied; no browser workaround was used. Prior October 7 live synthetic AI evidence remains historical and was not rerun for this release.

No remote website publishing, real sign-in, production database migration, carrier label/booking, real partner request, vendor dispatch or business message was performed. Shared multi-user operation depends on configuring and deploying the included authenticated backend in the user's environment.

## Reproduce and deploy

Install jsdom@26 and @electric-sql/pglite@0.3.14 separately from the static site. Run the ten `scripts/check-*.cjs` regression suites; run `node build-cloudflare.mjs` before `scripts/check-production.cjs`. Run `scripts/check-pages.cjs` normally and with the `recovery` argument for the page audits. Reports are included in `docs/verification-*.json`.

For GitHub Pages use **Deploy from a branch → main → / (root)**, retaining empty root `.nojekyll` and no custom `.github/workflows` or root `pages.yml`. `DEPLOY_FROM_BRANCH.md` contains current v47 upload and published-site checks. `DEPLOY_TO_WORKERS.md` covers the separate Workers build. The delivered ZIP contains complete source, without generated dist, dependencies or scratch QA files.
