# Optional authenticated 3PL processing API

This package includes a working server connector implementation and a local processing-request history. It does not contain a real partner endpoint or credential, and no live 3PL request was sent during development. Local forms, status records, shipping and imports work without the optional server connection.

## Required setup

Use the existing Supabase project used for sign-in and shared workspaces. Apply the migrations in this order:

1. `supabase/migrations/20261005_unified_system.sql` (existing shared workspace migration).
2. `supabase/migrations/20261008_fulfillment_workflows.sql` (draft validation and protected delivery outbox).

Deploy `supabase/functions/threepl-orders` using the Supabase CLI or your existing function deployment process:

```bash
supabase functions deploy threepl-orders
```

Keep JWT verification enabled. The function also verifies the signed-in user with the auth server and checks their organization membership. Only owner/admin/editor/manager roles can process or inspect requests through this endpoint. Service credentials are read on the server from the supported Supabase secret-key environment variables; they are never supplied by the page.

Set `STARK_3PL_CONNECTORS` as a server secret containing a JSON map. Each key is the actual organization UUID followed by a colon and the partner's ID in `logistics.tplNodes`:

```json
{
  "YOUR-ORGANIZATION-UUID:YOUR-PARTNER-NODE-ID": {
    "endpoint": "https://api.your-provider.com/orders",
    "token": "YOUR-SERVER-ONLY-PARTNER-TOKEN"
  }
}
```

The endpoint must use HTTPS, must not be a private/numeric host, and must implement the request/acknowledgment contract below. Redirects are rejected so credentials are not forwarded to another host. Keep partner credentials in server secrets, not a browser configuration file or the repository.

`STARK_ALLOWED_ORIGINS` is a comma-separated list of exact site origins. Defaults include the current Workers site and the GitHub Pages origin. Add your own preview/production origin explicitly if required. CORS permits POST with the authorization, apikey and content-type headers. CORS is not the authorization check: a valid session and organization access are still required.

Connect the shared organization workspace in Data Center. Create a 3PL shipment request and review its actual customer/address/line payload in Order history. If the current workspace is still labeled sample, the send dialog requires explicit confirmation that the selected data is working data; this preserves the records rather than clearing them.

## Website to server

POST to the existing Supabase project's `/functions/v1/threepl-orders` endpoint. The page attaches the session JWT in Authorization and the public project key in apikey. It sends only:

```json
{
  "organization_id": "YOUR-ORGANIZATION-UUID",
  "request_id": "3plreq_REQUEST-ID",
  "action": "process"
}
```

Use `action: "status"` to read the stored result without forwarding another order. The server obtains order details from the authenticated shared workspace, checks linked stock/shipments and compares the saved request with current order facts. Canonical JSON comparison and hashing tolerate PostgreSQL JSONB key ordering. Browser-supplied URLs, credentials or replacement order payloads are not accepted.

## Server to partner

The server sends `stark.3pl.order.v1` with the request ID, order number, customer PO, partner ID, customer name, address lines/city/state/ZIP, instructions, in-hands date, shipping method, third-party shipping account/ZIP and model/SKU quantities. Unit prices, packing-slip bytes, the Supabase session and other workspace records are excluded.

Headers include `Authorization: Bearer <partner token>` and `Idempotency-Key: <organization UUID>:<request ID>`. The partner must honor that key. A successful HTTP response must include this JSON acknowledgment:

```json
{
  "accepted": true,
  "request_id": "3plreq_REQUEST-ID",
  "order_id": "PARTNER-ORDER-ID"
}
```

An HTTP 200 alone, a UI message or a mismatched request ID is not an acknowledgment. Adapt the connector deliberately for a different partner contract, and validate it against the partner's sandbox before enabling real processing.

## Delivery states and recovery

| State | Meaning / next action |
| --- | --- |
| QUEUED | No confirmed send. Configure the connector or resolve validation/sync errors before processing. |
| SENDING | A durable server claim exists. Refresh status; do not create another send. |
| ACKNOWLEDGED | The partner returned the matching request ID and its order ID. Continue shipment management separately. |
| REJECTED | A definitive client-error response rejected the request. Correct configuration/data and review before retrying the same request ID. Server retries are bounded to five attempts. |
| UNKNOWN | Delivery could have occurred but could not be confirmed. Refresh status and reconcile with the partner before resending or cancelling. |

The database holds one delivery row per organization/request ID. A server-only RPC uses transaction locking and payload hashes to claim it. Acknowledged, in-flight and uncertain rows cannot claim another send. Client roles can read their organization's rows but cannot insert/update them or call the claim RPC.

If a server stopped after transmitting but before saving the result, SENDING may persist. Confirm the outcome using the original idempotency key with the partner, then have an authorized server operator reconcile the stored delivery state. There is no automatic expiration/resend of uncertain deliveries. Local cancellation remains blocked until the partner outcome is reconciled.

## Verification and references

Functional tests use mocked auth, database and provider adapters. Migrations, role permissions, tenant reads, durable claims and retry limits are also executed in an isolated PGlite PostgreSQL instance with synthetic principals. This verifies the included code; it does not verify your live Supabase schema, actual membership policies, server secrets, partner contract or provider stock. No live database was migrated and no live partner order was processed.

Official implementation references: [Supabase function authorization](https://supabase.com/docs/guides/functions/auth-headers), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database functions](https://supabase.com/docs/guides/database/functions).
