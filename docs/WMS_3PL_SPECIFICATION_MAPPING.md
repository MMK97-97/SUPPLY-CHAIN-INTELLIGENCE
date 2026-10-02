# WMS + 3PL Specification Mapping

## Warehouse Management

The implementation preserves the supplied WMS concepts and expands them into an executable workflow:

- **Localized physical coordinates:** `warehouse-management/inventory-bins.html` and the `inventory_bins` / `warehouse_inventory` database models.
- **Raw stock, reservations and damaged quantities:** location-level stock table, available-balance calculation and movement ledger.
- **Serialization:** SKU master indicators and receiving-line serial-number storage field in the production schema.
- **Wave Picking:** `warehouse-management/wave-picking.html` groups identical-SKU demand into waves with bin/SKU scan verification.
- **Branded Pack Slips:** `warehouse-management/packing-dispatch.html` generates white-label pack-slip content based on agency/program identity.
- **Receiving / Putaway:** dock appointments, ASN scan state, receipt line capture and putaway tasks.
- **Vendor PO three-way match:** receiving screen reconciles issued PO, Warehouse Receiving Log and vendor invoice before financial release.
- **Inventory accuracy:** cycle counts, variance review and immutable stock-movement schema.

## 3PL Management

- **Dynamic Order Routing Core:** `3pl-management/routing.html` evaluates local warehouse and eligible 3PL nodes using stock, regional position, estimated cost, variation support and SLA.
- **Outbound Contract:** the supplied `POST /v1/3pl/shipment-request` payload is represented in the routing/integrations screens and API contract.
- **Regional 3PL Inventory:** `3pl-management/network.html` shows node balances, reservations, internal registry quantity, variation eligibility and sync timestamps.
- **Shipment Lifecycle:** request → acceptance → picking → dispatch → delivery with tracking and cost.
- **Nightly Reconciliation:** `3pl-management/reconciliation.html` compares internal registry counts to 3PL balances and creates variance records.
- **24-hour Delay Escalation:** un-dispatched requests older than 24 hours are surfaced as delayed / escalated.
- **SLA Scorecard:** on-time dispatch, inventory accuracy, acknowledgement target and dispatch target per node.

## Integration boundaries

The packaged frontend uses browser storage for a safe static demonstration. Production authentication, partner credentials, webhook signature validation, inventory locks and scheduled reconciliation jobs belong in the server/API layer described in `database/api-contract.md` and `database/schema.sql`.
