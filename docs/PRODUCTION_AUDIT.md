# Production audit and fixes — v47

The complete v46 source was audited for startup, records, workflows, navigation, failure recovery, output safety, accessibility and packaging. The requested live GitHub Pages URL was unavailable to the web reader; this audit establishes the source release's behavior, not the current live deployment's behavior.

## Reproduced defects and corrections

| Trigger | Before | v47 behavior |
| --- | --- | --- |
| Browser storage quota fails while creating a customer, then Save is retried | Uncaught error; the module retained the failed draft and persisted two customer records on retry | Inline error; draft remains; failed module edits are discarded; retry persists one record |
| Saved workspace contains valid JSON with missing record groups, null/array/empty input, or broken JSON | Startup crashes or can initialize over invalid falsy records | Format/revision/record/currency/report-group checks reject invalid state; original bytes remain; recovery export is available |
| Recovery opens while regional report startup awaits an asynchronous callback | Replacing the body leaves report callbacks with missing nodes | Recovery hides/inerts the original content while retaining its nodes; callbacks finish without startup errors |
| Product code contains quotes and an HTML element payload | Catalog action attribute creates the injected element | Text/attribute escaping preserves the exact SKU without creating HTML |
| Save is pending or rejects | Legacy dialogs lack reliable error handling and keyboard controls | Shared dialog protects pending saves, displays errors, keeps drafts and supports a single retry |
| Upload/vendor/AI controls or unavailable decorative canvas | Some controls lack labels; absent canvas context throws | Accessible labels and graceful canvas fallback |

The corrections extend the existing site without replacing its business modules or report formulas. Inventory reservations/reconciliation, business workflow functions, all region-specific calculation assets and the regional AI implementation retain their verified calculations/source. Customer and vendor procurement, Sarasota shipping, warehouse execution, 3PL queues/imports/API outbox and separate transportation remain available.

## Verification

- 288 regression checks passed across ten freshly rerun suites.
- All 90 pages inspected; 79 startup simulations and 11 redirect/source inspections. A second all-page run checks corrupt-workspace recovery.
- 173 syntax checks and 1471 inspected local resources passed.
- Build: 90 HTML pages and 74 fingerprinted assets, with current release metadata.
- Actual form/button checks use synthetic records; external services are mocked. SQL runs in isolated PGlite.

See `VERIFICATION.md` and the included machine-readable reports for case names, methodology and limits. Real rendered layouts, transition timings, live account access, backend deployment and live partner/carrier services remain unverified.

## Publishing

Upload the entire extracted source to the repository root in one commit. For GitHub Pages retain **Deploy from a branch**, **main**, **/ (root)**, root `.nojekyll`, and no custom workflow files. Check published `VERSION.json` for `2026.10.08-unified-enterprise-production-audit47` and shared cache version `20261008-5`. The package is prepared for publishing; it has not been deployed by this request. Full instructions are in `../DEPLOY_FROM_BRANCH.md`.
