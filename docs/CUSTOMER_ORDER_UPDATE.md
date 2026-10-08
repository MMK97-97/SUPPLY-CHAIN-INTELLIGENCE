# Customer orders and navigation — v45, October 8

Release: `2026.10.08-unified-enterprise-customer-orders45`; source asset version: `20261008-3`. This source package replaces v44 and has not been published to the live site.

## Navigation changes

The duplicate Dashboard / Raw Report / Reorder Report / Active Brands / Instructions banner is removed from the 15 US/EU/Canada report pages and EU ATS. The reports remain available through the shared sidebar. Regional Workspace is removed from the sidebar and control tower; its old URL redirects to the selected region's inventory dashboard so bookmarks still work.

Search appears only on Order Management and Vendor Management screens, including vendor procurement and the vendor PO register. Other report filters, uploads, region selectors, dates, dropdowns and sorting remain available; text search controls on other modules are hidden and disabled. Legacy filter elements remain in the DOM so their existing module listeners retain startup compatibility.

## Create customer order

| Field | Behavior |
| --- | --- |
| Order type | Hold PO, Bulk PO or Firm PO |
| Customer PO# | Required customer reference; existing duplicate protection remains |
| Sales order# | Choose Same as customer PO# or Generate internally; internal number is assigned atomically when saved |
| Customer | Select an existing CRM account |
| Customer address | Read from CRM and saved as a separate order snapshot |
| Ship-to address | Choose a CRM ship-to, copy the customer address, or enter a custom destination |
| Address fields | Recipient/company, lines 1–3, city, state/province, ZIP/postal code and country |
| Shipping method | FedEx, UPS, USPS, LTL or other transport; domestic, international and custom/account-specific service choices |
| Third-party billing | FedEx/UPS/USPS method plus account# and billing ZIP/postal code; both billing fields are required together |
| LTL | Rome Transportation, TQL or C.H. Robinson; a custom contract option is also available |
| Special Instructions | Saved with the order |
| Model# | Region-scoped model suggestions; catalog SKU entry also supported |
| Description | Read-only, filled from the catalog; changed/unknown models clear old descriptions |
| Quantity / price / total | Positive whole quantities, editable unit price, catalog starting price and live totals |
| Inventory levels | Live operational on hand, reserved, damaged and available quantities; recorded warehouse balances shown separately |
| Fulfill from | Automatic warehouse suggestion or a manual Sarasota / Farmers Branch selection |

In **CRM → Agency accounts & programs → Manage addresses**, save the customer address and default ship-to address. The editor accepts blank addresses; a populated address needs line 1, city and postal code. It preserves other saved ship-to entries and existing orders. Selecting a customer fills its available CRM address choices. Custom delivery addresses remain editable and are not overwritten by quantity changes. Existing accounts without addresses show a clear missing-address message; no sample addresses are invented.

Saved orders retain customer and delivery address snapshots even if CRM changes later. Before saving, an address selected from CRM is resolved again against the current shared account. Draft editing can switch numbering modes; a generated number is retained while that mode stays selected. Validated orders retain their execution/credit protection and cannot be edited through draft entry.

Inventory levels come from the operational catalog/WMS, not an uploaded planning report unless that region has been imported into operations. Warehouse suggestions use rows explicitly assigned to Sarasota or Farmers Branch (or a warehouse with a matching name or `fulfillmentWarehouseId`). Unmapped Tampa/SE seed stock is not relabeled as Sarasota. If every line has enough stock at one recorded warehouse, that warehouse is suggested. If location balances are absent, the customer's preference or Sarasota default is shown with an explicit verification message. If known balances cannot cover all lines, automatic selection stays unassigned. Manual selection remains available. Location figures are existing WMS balance snapshots; this release does not introduce a new warehouse reservation ledger or split an order across warehouses.

Saving an unvalidated order does not reserve stock or send a shipment. Save & validate retains the existing catalog, region, available-stock, credit and delivery guards. Automatic suggestions do not book transport, buy a label, call a partner, or bypass validation. 3PL and Transportation remain separate modules.

## Shipping catalog maintenance

Carrier catalogs list named domestic and international services, with a custom/account-specific option so an unlisted contract method can still be recorded. Service and billing selections are order instructions, not live quotes or a carrier account eligibility response. The fulfillment team verifies route, package and account eligibility before dispatch.

Official references checked October 8, 2026:

- [FedEx Ship API documentation](https://developer.fedex.com/api/en-bm/catalog/ship/v1/docs.html)
- [UPS domestic services](https://www.ups.com/us/en/support/shipping-support/shipping-services/domestic)
- [UPS international services](https://www.ups.com/us/en/support/international-tools-resources/international-shipping-services)
- [USPS domestic services](https://www.usps.com/ship/mail-shipping-services.htm)
- [USPS international services](https://www.usps.com/international/mail-shipping-services.htm)

No delivery promises, prices, obsolete USPS First-Class Package domestic method or suspended Global Express Guaranteed service are encoded. Update `SHIPPING_SERVICES` in `assets/fulfillment-core.js` as carrier contracts change.

## Deployment and verification

Use the complete v45 package. For Workers, run `node build-cloudflare.mjs` and deploy with your existing authenticated account. For GitHub Pages, retain **Deploy from a branch → main → / (root)** and the empty `.nojekyll`; no custom workflows are added. See the deployment guides and `VERIFICATION.md`.

The prior regional AI fix remains intact. Browser rendering and page-transition timing remain unverified because browser preview was denied earlier. This update uses source checks, shared-state tests, jsdom forms/navigation, mocked transports and an isolated SQL test database. No real customer order, carrier transaction, 3PL send, account credential, database migration or live deployment was used.
