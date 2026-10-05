# Integrated system guide

## What is connected

| Workspace | Connected behavior |
|---|---|
| Enterprise control tower | Customer commitments, inbound POs, warehouse availability, 3PL activity, exceptions, events and audit changes are read from shared records. |
| Inventory & planning | US, EU and Canada retain separate upload, active-brand, forecast and reorder calculations. Normalized results appear in the control tower and can be imported into the shared catalog. |
| CRM | Customers, parent/child accounts, programs, catalog SKUs and contractual prices are shared with order entry. |
| Customer orders | Regular and event orders support Hold, Redemption, Bulk and Firm types; multiline quantities and prices are validated. Warehouse/3PL allocation and supplier dropship use separate execution paths. |
| Event planning | Saved event POs appear in the control tower and can prefill linked customer order entry, including item lines and in-hands dates. |
| Vendor purchasing | Inventory, Event and Dropship purposes share one PO register. Inbound physical POs create receiving documents. Supplier dropship POs link directly to customer orders. |
| Warehouse | Receiving, good/damaged quantities, partial putaway, location transfers, picking waves and packing jobs update the shared stock balance. |
| 3PL | Routing uses actual open customer orders. Acceptance, picking, dispatch, delivery and cancellation update linked customer records and partner balances. |
| Digital rewards | Demonstration dispatch assigns masked vault references to customer orders. Real voucher delivery needs a secure vendor API. |
| System & data | Global search, audit history, backup/restore, sample-to-empty workflow, migration and optional cloud connection are available from every working module. |

## Allocation and fulfillment

1. Add customers, programs and suppliers, or use the labeled sample workspace.
2. Upload a regional Raw Report. Existing analysis and reorder formulas are retained.
3. Open Data Center and import the selected regional inventory into operations. Imported SKU identifiers contain their region, so identical model numbers remain distinct across US/EU/Canada.
4. Set missing sales prices or vendor costs before committing orders or purchase orders.
5. Create a customer order. Stock remains on hand and is reserved until dispatch. Redemption moves allocation from its parent hold without reducing stock at entry.
6. Warehouse allocation creates SKU picking waves. Complete picking to generate packing jobs. Enter real tracking to dispatch; the stock deduction occurs once at dispatch.
7. A vendor PO creates a receiving document. Check in, scan actual good/damaged units, create putaway tasks and complete them. Remaining quantities create follow-up receiving documents. Shortcut receiving from procurement is idempotent across the vendor and warehouse views.
8. Route eligible single-SKU orders to a 3PL using the exact order quantity. Partner dispatch deducts partner stock; delivery does not deduct it again.
9. Supplier dropship orders link to Dropship vendor POs. Supplier dispatch updates the customer order without passing stock through warehouse inventory.

Repeat regional imports refresh catalog descriptions/demand but preserve existing operational stock quantities. Uploaded planning snapshots and operational balances remain separately traceable; an upload does not silently reset dispatched or allocated stock.

## Navigation

`index.html` and `business-operations.html` open one enterprise control tower. The fixed desktop sidebar nests inventory/planning, CRM, orders/events, vendors/purchasing, warehouse, 3PL/transportation and system/data pages. At narrow viewport widths the same navigation opens as a drawer. Existing regional deep links and `index.html?workspace=...` remain compatible.

Missing warehouse inventory, receiving, wave-picking, packing and cycle-count routes have been restored. All nested paths resolve under the repository's deployment root.

The current interface revision mounts shared navigation after the module's page initialization. Earlier, the deferred navigation script ran at the document's interactive state and the module's later body replacement erased its sidebar and header. This loading order is now covered by regression checks. Dashboard selection and the cycle-count compatibility route also open the correct navigation group.

Operations and logistics now share light cards, readable tables and status badges, visible secondary buttons, consistent forms and dialogs, and a warehouse flow that wraps on small screens. Existing business records and allocation/dispatch behavior are preserved.

## Deployment to your existing website

Publish this static system using **Deploy from a branch**. No custom workflow is included.

1. Extract the ZIP. Copy everything **inside** `SUPPLY-CHAIN-INTELLIGENCE-main/` to the existing repository root, including `.nojekyll`, every file in `assets/` and all nested module folders. Avoid nesting another project folder inside the repository. Verify that `index.html` is directly in the repository root.
2. Keep the removed `.github/workflows` directory absent. Remove the obsolete root `pages.yml` if it remains in your repository.
3. In repository Settings → Pages → Build and deployment, set the following and click Save:

| Setting | Value |
|---|---|
| Source | Deploy from a branch |
| Branch | main |
| Folder | / (root) |

4. Commit the complete files to `main`. GitHub automatically publishes changes to the selected branch. The files are already static; do not select `/docs` or use `dist/` as the publishing folder for this package.
5. Verify that `.nojekyll` exists at the same level as `index.html`. It is an empty marker file that bypasses Jekyll processing. If the upload picker omits it, create it through GitHub's Add file → Create new file.
6. After publication, hard-refresh the site to fetch the corrected scripts and styles, versioned `20261005-2` across all working pages. Upload the full package together, including every nested HTML page and the complete `assets/` folder. The existing URL remains `https://mmk97-97.github.io/SUPPLY-CHAIN-INTELLIGENCE/index.html`. Open Data Center and export a backup before clearing sample records or restoring a different workspace.

GitHub may display its built-in **pages build and deployment** job in Actions even when Source is Deploy from a branch. This is GitHub's automatic publisher; no repository workflow files are required. Do not rerun the deleted custom deployment workflow from an older commit. A new commit to `main` triggers publication using the selected branch source.

This package also repairs an incomplete source upload: its new landing pages referenced missing shared system scripts, and several nested module pages/scripts still matched the original pre-integration version. The matching integration files and missing warehouse routes have been restored. Existing uploaded files that already matched the integrated system were retained.

The supplied login, Supabase public configuration, AI worker, regional reports, freight tools and optional Cloudflare configuration remain included. No change has been pushed to the live repository, Pages settings or database in this session.

## Optional shared cloud workspace

1. Use the same Supabase project as the supplied login configuration. Existing `organizations` and `organization_members` tables are required; membership must include `user_id`, `organization_id`, `role` and `created_at` as used by the existing authentication flow.
2. Run `supabase/migrations/20261005_unified_system.sql` in that project's SQL editor. It creates a separate `stark_unified_workspaces` table and save RPC, without replacing the older domain tables.
3. Sign in using the existing login page and open Data Center.
4. Select Connect shared workspace. Load the existing organization workspace, or deliberately replace it with local records. Export a backup first when replacing records.
5. Saves include shared operations, event planning, normalized regional results and regional report datasets. Loading shared records restores the report datasets for regional analytics on the current device.

Cloud reads are scoped by organization membership. Writes require owner/admin/manager/editor membership and go through the guarded save RPC. The server checks the expected revision under a transaction lock; a conflicting write pauses synchronization and preserves local records for backup/reconciliation. Domain-specific high-volume APIs, scheduled expiry/reconciliation, live carrier labels, and live vendor/3PL webhooks can extend this foundation using the existing API contracts.

The cloud adapter is optional until the migration is installed. Actual login, database policies and external integrations must be verified in your deployed environment. The frontend supports demonstration partner contracts and masked voucher references; it does not contact vendors or carriers to create real shipments.

## Data preservation and recovery

The original browser operations/logistics keys remain intact after initial migration. The shared state uses `stark.unifiedSystem.v1`; the regional IndexedDB stores and active-brand settings retain their established names. Backups contain shared operations and regional inventory datasets/settings. Sales uploads and separate event warehouse source workbooks retain their existing browser databases and should also be retained/exported through their original tools when needed.

If a saved workspace cannot be read, the app preserves it and offers a raw-record export. Recover using a valid backup after repairing storage. Local browser saves have browser quota limits; a failed save reports the error without acknowledging an unpersisted transaction.
