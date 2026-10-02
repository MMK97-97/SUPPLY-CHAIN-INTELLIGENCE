# Supply Chain Intelligence — Complete CRM / Order / Vendor Build

This package combines the existing Supply Chain Intelligence static website with the enterprise operations suite requested for CRM, Order Management and Vendor Management.

## Main entry points

- `index.html` — existing Supply Chain Intelligence home. A lightweight loader adds Business Operations plus CRM, Order Management and Vendor Management links without changing the existing analysis engine.
- `business-operations.html` — enterprise operations landing page.
- `crm.html` — CRM dashboard.
- `order-management.html` — Order Management Engine dashboard.
- `vendor-management.html` — Vendor Management System dashboard.
- `vendor-po-management.html` — vendor PO / receiving pipeline.

The full nested workspaces are under `crm/`, `order-management/`, and `vendor-management/`.

## Frontend persistence

The included operations UI is immediately usable as a GitHub Pages static application and stores demo/working records in browser `localStorage`. Production persistence belongs behind an authenticated API. `database/schema.sql`, `database/api-contract.md`, and `supabase/migrations/20261002_enterprise_operations.sql` provide the database starting point.

## Important security boundary

Do not place vendor credentials, WMS secrets, private API keys, encryption keys, or plaintext voucher codes in GitHub Pages JavaScript. The digital-voucher UI intentionally stores masked sample references only. Production voucher decryption and vendor/API credentials must remain server-side.

## Deploy

The included `.github/workflows/deploy.yml` deploys the repository root to GitHub Pages when `main` is pushed. In GitHub repository settings, set **Pages → Source** to **GitHub Actions**.

## Existing auth / Supabase configuration

If your current live repository already contains `login.html`, `auth-callback.html`, or an `assets/supabase-config.js` with your project configuration, keep those existing files when merging this package. This archive does not contain credentials.
