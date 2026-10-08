# Specification-to-Implementation Mapping

## October 8 fulfillment revision

The current customer-entry page uses Hold PO, Bulk PO and Firm PO. Redemption remains on its linked lifecycle page. The new order queues, Sarasota shipping, vendor PO fields and separate 3PL/Transportation modules are mapped in [FULFILLMENT_WORKFLOWS.md](FULFILLMENT_WORKFLOWS.md). Optional authenticated processing API setup is in [3PL_API_SETUP.md](3PL_API_SETUP.md). The sections below describe the retained system and earlier design.

## Wholesale Incentive CRM
- Parent / child account topology → `crm/accounts.html`
- Contract price book → `crm/catalog.html`
- Line-of-credit guardrails → CRM dashboard + Hold PO validation
- Physical merchandise and digital voucher visibility → CRM dashboard/catalog
- Partner API keys + webhook history → `crm/partner-portal.html`
- High-density operations UI → shared `enterprise-suite.css`

## Order Management Engine
- Exact-entry order classification → Hold/Bulk/Firm in `order-management/new-order.html`; Redemption on its linked page
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
