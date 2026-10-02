# Specification-to-Implementation Mapping

## Wholesale Incentive CRM
- Parent / child account topology → `crm/accounts.html`
- Contract price book → `crm/catalog.html`
- Line-of-credit guardrails → CRM dashboard + Hold PO validation
- Physical merchandise and digital voucher visibility → CRM dashboard/catalog
- Partner API keys + webhook history → `crm/partner-portal.html`
- High-density operations UI → shared `enterprise-suite.css`

## Order Management Engine
- Exact-entry order classification → four-type gatekeeper in `order-management/new-order.html`
- Hold PO soft reservation → Hold creation logic
- Redemption parent reference / reserved drawdown → Redemption validation + linked lifecycle page
- Bulk hard allocation + warehouse/shipping marks → Bulk form + execution register
- Firm immediate commitment → Firm form + execution pipeline
- Hold expiry → on-demand browser simulation + production scheduled-job note
- Live stock counters → order entry inventory grid
- Order-type visual borders → orange / purple / blue / green type cards and form border

## Vendor Management System
- Vendor parent + warehouse + price-book models → `vendor-management/vendors.html`
- Physical reorder engine → `vendor-management/procurement.html`
- Pending Arrival until ASN/receiving → vendor PO board and receive action
- Digital voucher capacity / replenishment → `vendor-management/digital-vault.html`
- Shipment webhook contract → `database/api-contract.md`
- SLA scorecard thresholds → `vendor-management/sla.html`
