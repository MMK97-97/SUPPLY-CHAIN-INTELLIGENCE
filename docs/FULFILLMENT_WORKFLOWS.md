# Customer orders, shipping, 3PL and procurement

October 8 revision. All modules use the existing shared workspace, order IDs, vendor PO IDs and stock balances. 3PL and Transportation have separate sidebar groups and overview pages. Existing regional calculations, MK AI and navigation improvements remain available.

## Requested pages and fields

| Requirement | Page / behavior |
| --- | --- |
| 3PL order history and orders sent through APIs for processing | `3pl-management/order-history.html`: saved request payloads, API delivery state, delivery events, partner order IDs and existing partner shipment history. |
| 3PL shipment requests | `3pl-management/shipment-requests.html`: select a customer order and active partner; validate the entire order against partner stock and reserve every line atomically. |
| Manage 3PL orders | `3pl-management/orders.html`: acceptance, picking, dispatch and delivery queues with linked customer order quantities. |
| Ship 3PL orders | `3pl-management/ship-orders.html`: record the partner's actual carrier and tracking confirmation. |
| Upload 3PL shipments | `3pl-management/upload-shipments.html`: CSV/XLS/XLSX preview, downloadable template, validation errors, duplicate protection and an atomic import. |
| Transportation | `transportation/index.html`: freight estimation, consolidation and carrier tracking; separate from 3PL order processing. |
| Order search by PO#, order#, tracking#, model# or date | `order-management/index.html` and related queues. Dates use YYYY-MM-DD. The register and shared search include generated order numbers and linked shipment tracking. |
| Customer order type | `order-management/new-order.html`: Hold PO, Bulk PO or Firm PO. The existing Hold-to-Redemption workflow remains available on its own page. |
| Customer PO#, customer, address lines 1/2/3, city/state/ZIP | Structured customer order fields; stored on the shared order record. |
| Instructions, in-hands date, shipping method | Stored with the order and shown in order details and partner request payloads. |
| Third-party shipping account# and third-party ZIP | Paired billing fields. Providing only one produces a validation issue. |
| Model#, unit price, quantity, total | Multiple model lines, positive whole quantities, prices with two decimals, live line totals and a customer-currency order total. |
| Warehouse: Sarasota / Farmers Branch | Explicit warehouse assignment controls the local shipping queue. Existing orders can update Delivery / warehouse without replacing quantities or allocations. |
| All open orders | `order-management/index.html`: all orders that have not shipped, delivered, expired or been cancelled. |
| Order issues: no inventory, discontinued, feeds only, internal use, out of stock | `order-management/issues.html`: searchable issue queue and issue-type filter. Missing delivery details, credit and other validation problems also remain visible. |
| Cancelled orders | `order-management/cancelled.html`: cancelled customer records remain searchable. |
| Unvalidated orders | `order-management/unvalidated.html`: staged records that do not reserve stock or create picking work. |
| Ship orders assigned to Sarasota | `shipping/index.html`: open local Sarasota orders, with Hold and validation gates. Partner and supplier execution use their separate queues. |
| Daily shipment report | `shipping/daily-report.html`: shipment lines by America/New_York business date, with CSV and real Excel exports. |
| Create vendor PO by model#, vendor item#, title, description and quantity | `procurement/new-po.html`: multiline vendor PO creation with supplier, unit cost, delivery date, purpose and receiving warehouse. |
| Open vendor PO management, tracking, notes, packing-slip attachment | `procurement/index.html`: PO details, tracking/notes editing and bounded PDF/PNG/JPEG packing slips. Receiving remains connected to WMS. |

## Order lifecycle

1. Create a customer order. Save unvalidated, or choose Save & validate. A customer account and model-line quantities/prices are required to save; missing catalog models can remain as unlisted references in the issues queue.
2. Validation checks the customer, credit, delivery fields, warehouse, model eligibility, region and available stock. Discontinued, feeds-only and internal-use items cannot enter this physical fulfillment workflow. Use the existing digital workflow for digital rewards.
3. A successful validation reserves stock and commits customer credit once. Stock stays on hand until actual dispatch. Issues and unvalidated records have no reservations and no picking waves.
4. Correct an unresolved order with Edit, then validate it again. Existing allocated orders use Delivery / warehouse to complete the new fields without reallocating stock or changing quantities. New redemptions retain the parent Hold's warehouse assignment.
5. In Sarasota Shipping, confirm completed picking/packing and enter actual carrier/tracking information. Dispatch updates stock, packing records, movement history and the daily report atomically. It records a real confirmation; it does not buy a carrier label or book transportation.
6. Cancellation releases unfulfilled reservations. Partially shipped orders require return or remaining-balance reconciliation. An order with acknowledged, in-flight or uncertain 3PL API delivery cannot be cancelled locally without partner reconciliation.

Operational stock uses the existing catalog and WMS balances. Warehouse assignment selects an execution queue; it does not invent a warehouse-specific stock balance when the source records do not contain one. Regional report imports remain distinct from live operational stock updates.

## Partner fulfillment and uploads

Shipment requests can validate against partner stock even when local stock is insufficient. They transfer any existing local allocation, reserve each partner line and create linked shipments. Once local picking or packing has started, routing is blocked until that execution is reconciled.

Each partner shipment retains its own remaining quantity. A multi-model order stays open until all lines dispatch, and becomes delivered only after every linked shipment is delivered. Partner dispatch deducts partner stock, not Sarasota stock.

The shipment template uses `shipmentId`, `orderRef`, `model#`, `quantity`, `tracking#`, `carrier`, and `shippedDate`. Use the shipment ID when possible. Order/model references must resolve to exactly one shipment. Dates must be valid and not in the future. One row must match the exact shipment quantity. The import preview does not mutate data. Every invalid row blocks the full import, a stale preview must be refreshed, and repeated confirmations with the same tracking and quantity are skipped. Uploads are limited to 5 MB and 2,000 rows.

Use Order history to review and export a processing request or send it through the optional server API. QUEUED is a local request, ACKNOWLEDGED confirms API receipt, and UNKNOWN means delivery has not been confirmed. Shipment execution and API delivery are distinct states. API configuration and deployment are described in `3PL_API_SETUP.md`; no live partner is configured in this source package.

## Vendor POs and packing slips

Vendor PO models must already exist in CRM Catalog or imported regional inventory. Add a missing model there first. Each new line requires its vendor item number, title, description, quantity and unit cost. Inventory and Event POs create receiving work; the retained Dropship workflow requires a matching supplier-fulfilled customer order.

Tracking and notes update the same purchase order. A packing slip can be downloaded from its PO details. Supported formats are PDF, PNG and JPEG, up to 1 MB each, five attachments and 2 MB total per PO. File headers are checked, downloads keep the detected document extension, and attachments are not rendered as active HTML. They are stored with the PO so backup/restore and optional shared synchronization retain their bytes. A failed storage-quota write preserves the previous record; use a smaller slip when browser capacity is exhausted.

## Compatibility and deployment

Existing orders, accounts, supplier POs, inventory and storage keys remain in place. The workspace remains schema version 1 with additional optional fields. Apply `20261008_fulfillment_workflows.sql` after the previous unified-system migration for cloud synchronization of unlisted draft models and server outbox records.

The website has not been published. Use `DEPLOY_TO_WORKERS.md` for the current Workers target, or `DEPLOY_FROM_BRANCH.md` for GitHub Pages. Graphical browser checks and live sign-in/partner integration remain pending; automated results are in `VERIFICATION.md`.
