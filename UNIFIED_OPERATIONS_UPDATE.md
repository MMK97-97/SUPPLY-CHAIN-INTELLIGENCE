# MK97 unified operations update

Source: public SUPPLY-CHAIN-INTELLIGENCE main archive, commit `0741e15e8a1d118c90267fa5800f190b6aa2501c`, inspected November 4, 2026. The live site was also inspected in Chrome. This package has not been deployed.

## Apply to the project

Copy the project folder's contents into the repository root, or copy the exact paths listed in `UNIFIED_OPERATIONS_CHANGED_FILES.json` if updating this baseline. Keep the updated HTML cache tags and their corresponding JavaScript files together. Use the project's existing GitHub Pages deployment process. No database migration is required for this update. Test in the sample workspace before operating on organization data.

## What changed

- **One Operations home.** The main workspace opens with an operational work queue, stock coverage, and invoice matching. Existing module cards, analytics, Mail, Tasks, MK Co-Pilot, scanner, fulfillment and 3PL routes remain in the same app. The former root `integrations.html` bookmark opens Operations. The separate simulated Enterprise Suite and fabricated dashboard metrics were removed.
- **Workspace settings.** The former Platform Studio page is under Profile → Workspace settings and System & Data. Its terminology presets change labels, visibility options change navigation, and the perspective sets the default queue filter. Settings are browser preferences, not security roles. Theme and density apply to Operations. The Data Center remains the entry point for organization data connections and backups.
- **Work queue.** Highlights real record exceptions: overdue inbound, missing ETAs, low stock, reservations above usable stock, entered receipts awaiting completion, due orders, hold expiries, validation, cycle-count variance, uncertain 3PL acknowledgment and invoice discrepancies. Create follow-up saves an existing-format Task with a backlink to the source record. The queue avoids duplicate active follow-ups.
- **Stock coverage.** Shows on-hand, reserved, damaged, free stock, dated inbound and projected free stock for the selected region and window. Projected free stock subtracts damage and reservations once, then adds dated confirmed inbound in range. Overdue, unconfirmed, undated, out-of-window, dropship and unposted staged quantities do not increase projected free stock. Draft demand is informational. Expand a SKU for vendor PO and bin evidence. This is a regional planning estimate, not a warehouse allocation or customer delivery promise.
- **Invoice matching.** Choose one issued warehouse PO, enter the supplier invoice header and billed item lines, then Compare invoice. The app checks exact SKU, currency, unit price, ordered quantity, posted usable receipts and quantities used by previously matched reviews. Damaged units posted through receiving and units still in staging are excluded from usable receipts. Duplicate supplier invoice numbers are blocked. Saving records the result, inputs and evidence in the existing workspace snapshot and audit. Exception records can be corrected and rechecked. Matched records retain their saved evidence. Tax, freight, credits, AP postings, payment approval and general ledger are outside this workflow.

## Verification

- New focused tests: **19 passed** (work queue, supply calculation, matching, audit and stale saves, settings, old bookmark).
- Existing barcode regression: **63 core and 14 DOM integration checks passed**.
- Broader fulfillment regression: **40 passed / 9 failed**, same nine failures before and after this update. Includes the existing permission and navigation/form fixture failures.
- Cloud Chrome preview used fictional sample records. Checked matched invoice save, cumulative receipt and price exceptions, the linked Tasks backlink to one exact SKU, saved perspective, 12 module cards, analytics, and the old Enterprise Suite bookmark. Queue and invoice form had no page-level horizontal overflow at 320, 390 and 768 px.
- Authenticated production sync, physical cameras, accounting posting, and live external services were not exercised.

Run: `node --test scripts/check-unified-operations.cjs scripts/test-platform-studio.cjs` (settings test uses `jsdom`). Barcode regressions: `node scripts/check-scanning.cjs` and `node scripts/check-scanning-ui.cjs` (development dependencies `jsdom` and `@zxing/library`).

Design references: [NetSuite three-way match](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4096219721.html) and [SAP advanced available-to-promise](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/f132c385e0234fe68ae9ff35b2da178c/dde130dd4dc7412cb87d16a4edb6679d.html). This update implements the scoped workflows above.
