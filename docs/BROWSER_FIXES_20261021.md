# Browser QA fixes — October 21, 2026

This patch addresses the eight issues reproduced on the live GitHub Pages website. It updates the uploaded source package; it has not been deployed to the live website.

| Finding | Corrected behavior |
| --- | --- |
| Dashboard order links open unrelated records | The order register waits for shared state, honors the search query, and displays only the shared workspace records. Edit links use the stable internal order ID. |
| Existing order loads the wrong customer PO and quantities | The form loads the saved customer PO, sales order number, line quantities/prices, address, shipping, program, instructions, and notes. A draft save updates the same ID and rejects stale edits. |
| Net price differs from item details | Both catalog views and the detail tab use the recorded net sale price. Procurement unit cost has its own label; no stored prices are changed. Net/Retail sorting and filtering follow the selected price type. |
| 7D selects a 30-day graph | The snapshot and hidden accessible selector both support 7, 14, 30, and 90 days. Counts and date bins follow the selected range. |
| Vendor PO search does not update | Typing filters the supplier PO rows immediately and retains keyboard focus. URL-based supplier filters also work. |
| Pagination is decorative | Page counts, row slices, Previous/Next/First/Last buttons, and page size are calculated from the filtered records. Filters reset to page one; empty results close stale order details. |
| Credit utilization is inconsistent | Utilization is calculated from shared credit used and credit limits. Different currencies stay separate; zero limits show an em dash. |
| Credit amount wraps in the middle of the number | KPI amounts stay on one line, and the sparkline can move to another row. |

## Order lifecycle

Allocated and closed orders display their actual saved details without allowing a draft overwrite. Existing delivery/warehouse and dispatch workflows continue to manage those orders. Draft saves and validation use the shared fulfillment APIs, which prevent invented inventory, duplicate order IDs, duplicate credit charges, and stale overwrites. Unknown order IDs show an explicit error instead of creating a default order.

Shipping actions open the shipping workflow. Deleting is limited to unvalidated drafts; active orders can be cancelled through the existing guarded cancellation workflow. Missing CRM addresses remain empty.

## Verification

- 19 focused regression checks passed in `scripts/check-browser-fixes.cjs`.
- 23 existing core workflow checks passed in `scripts/check-workflows.cjs`.
- The broader `scripts/check-fulfillment.cjs` suite has 45 passing checks and four failures. Running that suite against the untouched uploaded ZIP produces the same four failures. They concern obsolete navigation/form fixtures and are recorded in `verification-browser-fixes-20261021.json`.
- Changed JavaScript and inline scripts pass syntax checks. No new broken local file references were introduced.
- These checks run the actual source scripts in their browser/defer order with jsdom@26 and synthetic local records. No authentication, carrier, payment, AI, or partner service was contacted.
- The cloud browser blocked the private preview address (`ERR_BLOCKED_BY_CLIENT`). The number-wrapping CSS is verified through computed styles; graphical desktop/mobile layout and the deployed site still need browser verification after publishing.

To run the focused checks, install `jsdom@26` as a development-only dependency, then run `node scripts/check-browser-fixes.cjs` and `node scripts/check-workflows.cjs`.

## Publishing

Upload the contents of `SUPPLY-CHAIN-INTELLIGENCE-main/` to the existing GitHub repository root, including the complete `assets/` directory. Preserve the folder structure. The changed JS/CSS references have the version `20261021-fixes1` so existing browsers request the corrected assets. Existing browser records are retained; resetting the workspace is unnecessary.
