# Stark Enterprise Operations Add-on

This package adds three global enterprise modules to the existing **SUPPLY-CHAIN-INTELLIGENCE** GitHub Pages project without replacing the existing regional inventory/sales pages:

- **CRM** — agency hierarchy, programs, credit guardrails, contractual pricing, product/catalog board, partner API keys and webhook history.
- **Order Management Engine (OME)** — strict Hold / Redemption / Bulk / Firm PO segregation, inventory validation, linked hold allocations, expiry handling, warehouse queues and execution documents.
- **Vendor Management System (VMS)** — vendor master data, warehouses, tiered cost/MOQ price books, replenishment triggers, vendor PO receiving, digital-code capacity and SLA scorecards.

## Quick deployment into the existing repository

1. Extract this ZIP.
2. Copy these items into the **root** of the existing `SUPPLY-CHAIN-INTELLIGENCE` repository:
   - `business-operations.html`
   - `crm/`
   - `order-management/`
   - `vendor-management/`
   - `assets/enterprise-suite.css`
   - `assets/enterprise-suite.js`
   - `assets/index-suite-loader.js`
   - `database/` (optional for GitHub Pages, recommended for production engineering)
3. Add the following single line immediately before `</body>` in the existing root `index.html`:

```html
<script src="assets/index-suite-loader.js?v=20261002-1"></script>
```

That loader adds a **Business Operations** header link and CRM / Order Management / Vendor Management buttons to the existing module grid. It does not replace the current Supply Chain Intelligence logic.

## Pages included

### CRM
- `crm/index.html` — operations dashboard
- `crm/accounts.html` — parent/child agency hierarchy + programs + credit exposure
- `crm/catalog.html` — physical/digital catalog + stock state + price books
- `crm/partner-portal.html` — API keys, sandbox payload and webhook history

### Order Management
- `order-management/index.html` — control tower and execution queues
- `order-management/new-order.html` — strict type-gated order entry
- `order-management/hold-redemption.html` — linked Hold → Redemption lifecycle
- `order-management/bulk-firm.html` — Bulk and Firm execution register

### Vendor Management
- `vendor-management/index.html` — vendor control dashboard
- `vendor-management/vendors.html` — master profiles + warehouse + price book view
- `vendor-management/procurement.html` — replenishment triggers + vendor PO lifecycle + ASN receiving
- `vendor-management/digital-vault.html` — masked digital-token capacity and replenishment controls
- `vendor-management/sla.html` — target-vs-actual SLA scorecard

## Functional demo behavior

The frontend is fully interactive on GitHub Pages and persists demo changes in browser `localStorage`. You can create accounts, programs, contract prices, customer orders, vendors and replenishment POs; receive vendor POs; run hold expiry; replenish and dispatch masked voucher records; and export selected CSV / text / JSON outputs.

Use **Reset demo** in the header to restore the included sample dataset.

## Production architecture

GitHub Pages cannot provide centralized persistence, RBAC, transactional inventory locking, secure secrets, scheduled jobs or a server-side key-management boundary. The `database/` folder therefore includes:

- `schema.sql` — PostgreSQL schema for CRM, inventory, order segregation, vendor POs, SLA records, digital token metadata, API keys and webhooks.
- `api-contract.md` — recommended endpoints and security requirements.

For production, replace the browser storage adapter in `assets/enterprise-suite.js` with authenticated API calls to a PostgreSQL-backed service (FastAPI, NestJS, etc.). The database/API service should enforce credit checks and inventory allocation in transactions, expire Hold POs on a scheduled job, validate signed webhooks and keep digital voucher plaintext behind KMS/HSM-backed encryption.

## Order rules implemented in the demo

- **Hold PO:** checks customer credit and public available stock, soft-reserves the requested quantity, records an expiration date and keeps the order in an allocated hold state.
- **Redemption PO:** requires an active parent Hold PO and rejects quantities above the remaining reserved bucket.
- **Bulk PO:** hard-allocates inventory immediately and requires warehouse destination + shipping marks.
- **Firm PO:** hard-allocates inventory immediately and routes directly to warehouse picking or a digital execution path.

## Vendor rules implemented in the demo

- Inventory at/below safety stock appears in the replenishment trigger board.
- Vendor price-book mapping provides cost, MOQ and tier context for draft POs.
- Vendor PO receiving posts inventory only when the receiving action is completed.
- Digital voucher pages show masked records only; no real secret code values are stored in the package.
- SLA colors follow the supplied thresholds: **green >98%**, **yellow 90–98%**, **red <90%**.

## File structure

```text
business-operations.html
assets/
  enterprise-suite.css
  enterprise-suite.js
  index-suite-loader.js
crm/
order-management/
vendor-management/
database/
docs/
```

