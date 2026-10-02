# Production API Contract

The included frontend is static and GitHub Pages compatible. In production, replace the browser data adapter with authenticated API calls to a PostgreSQL-backed service.

## CRM
- `GET /v1/accounts`
- `POST /v1/accounts`
- `GET /v1/accounts/:id/programs`
- `POST /v1/programs`
- `GET /v1/catalog`
- `POST /v1/accounts/:id/price-book`
- `GET /v1/partner/webhooks`
- `POST /v1/partner/api-keys`

## Order Management Engine
- `POST /v1/orders/hold`
- `POST /v1/orders/redemption`
- `POST /v1/orders/bulk`
- `POST /v1/orders/firm`
- `GET /v1/orders?type=&status=`
- `POST /v1/orders/:id/cancel`
- `POST /internal/jobs/expire-holds`

### Required order boundary behavior
The API must classify `order_type` before allocation logic runs. Hold, Redemption, Bulk and Firm orders must never share a generic allocation branch.

## Vendor Management
- `GET /v1/vendors`
- `POST /v1/vendors`
- `GET /v1/vendors/:id/price-book`
- `GET /v1/procurement/replenishment-candidates`
- `POST /v1/vendor-pos`
- `POST /v1/vendor-fulfillment/ship-notice`
- `POST /v1/vendor-fulfillment/asn`
- `GET /v1/vendor-sla`
- `POST /v1/digital-vault/replenish`
- `POST /v1/digital-vault/dispatch`

## Vendor shipment webhook example
```json
{
  "vendor_id": "vend_sony_electronics_global",
  "purchase_order_reference": "PO-2026-887411",
  "fulfillment_status": "dispatched",
  "consignment_details": {
    "carrier_code": "FEDEX_PRIORITY_OVERNIGHT",
    "tracking_number": "TRK772839410192",
    "dispatch_timestamp": "2026-10-02T16:04:22Z"
  },
  "shipped_items": [
    {
      "sku": "PHYS-SONY-WH1000XM5",
      "quantity_shipped": 50,
      "serial_numbers": ["SN019A", "SN020A"]
    }
  ]
}
```

## Security requirements
- Use authenticated sessions with RBAC for internal staff and scoped credentials for agency/vendor integrations.
- Hash API secrets; only show the cleartext value once at creation.
- Encrypt voucher payloads with a managed KMS/HSM-backed key hierarchy.
- Validate all incoming webhook signatures and implement replay protection.
- Record immutable audit events for financial, inventory and digital-token state transitions.
