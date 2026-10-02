# Operations Suite deployment

This update adds four connected modules without changing the existing inventory, sales, freight, event or tracking calculations:

- `crm.html`
- `order-management.html`
- `vendor-management.html`
- `vendor-po-management.html`

## 1. Apply the database migration

In the Supabase SQL Editor, run these files in order if the first migration has not already been applied:

1. `supabase/migrations/20261001174600_initial_secure_schema.sql`
2. `supabase/migrations/20261002150000_operations_suite.sql`

The operations migration creates organization- and region-scoped tables, row-level security policies, role-based editing, audit records, calculated totals, indexes and realtime publication entries.

## 2. Deploy the website

Commit the updated files to the branch connected to Cloudflare. Keep the existing Cloudflare commands:

```text
Build command: node build-cloudflare.mjs
Deploy command: npx wrangler deploy
```

The build script copies the new pages and assets into `dist/` automatically.

## 3. Access and roles

Open any authenticated workspace page. The sidebar contains a new **Operations** group with all four modules. The selected `US`, `EU` or `CA` region is retained between modules.

- `owner`, `admin`, and `planner`: create, edit, duplicate and delete records.
- `viewer`: read and export only.

If the cloud database is temporarily unavailable, the UI enters continuity mode and preserves local browser data for that organization and region. Cloud mode remains the production system of record.

## 4. Validation

After deployment, verify:

1. Create a CRM account.
2. Create an event or regular order linked to that account.
3. Create a vendor.
4. Create an event, inventory or dropship PO linked to the vendor and, optionally, the customer order.
5. Confirm the KPI totals, CSV exports and realtime updates in a second browser tab.
