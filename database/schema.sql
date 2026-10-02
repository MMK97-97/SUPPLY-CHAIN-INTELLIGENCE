-- Stark Enterprise Operations
-- PostgreSQL reference schema for CRM + Order Management Engine + Vendor Management System
-- Designed as the production persistence layer behind the GitHub Pages frontend.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE account_status AS ENUM ('ACTIVE','REVIEW','SUSPENDED','CLOSED');
CREATE TYPE account_type AS ENUM ('PARENT','CHILD');
CREATE TYPE product_nature AS ENUM ('PHYSICAL','DIGITAL');
CREATE TYPE order_entry_type AS ENUM ('HOLD_PO','REDEMPTION_PO','BULK_PO','FIRM_PO');
CREATE TYPE order_fulfillment_status AS ENUM ('STAGED','ALLOCATED','PICKING','SHIPPED','CANCELLED','EXPIRED');
CREATE TYPE vendor_status AS ENUM ('ACTIVE','AUDIT_WARNING','SUSPENDED');
CREATE TYPE vendor_po_status AS ENUM ('DRAFT','PO_ISSUED','DISPATCHED','PENDING_ARRIVAL','RECEIVED','CANCELLED');
CREATE TYPE token_state AS ENUM ('AVAILABLE','DISPATCHED','REVOKED');

CREATE TABLE agency_accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_account_id UUID REFERENCES agency_accounts(account_id) ON DELETE SET NULL,
  account_type account_type NOT NULL DEFAULT 'PARENT',
  account_name VARCHAR(200) NOT NULL,
  status account_status NOT NULL DEFAULT 'ACTIVE',
  primary_contact_name VARCHAR(150),
  primary_contact_email VARCHAR(250),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  payment_terms VARCHAR(80),
  credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_used NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (credit_limit >= 0),
  CHECK (credit_used >= 0)
);

CREATE TABLE incentive_programs (
  program_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES agency_accounts(account_id) ON DELETE CASCADE,
  program_code VARCHAR(100) UNIQUE NOT NULL,
  program_name VARCHAR(200) NOT NULL,
  start_date DATE,
  end_date DATE,
  status VARCHAR(40) NOT NULL DEFAULT 'LIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_catalog (
  sku_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(120) UNIQUE NOT NULL,
  model_number VARCHAR(120),
  brand VARCHAR(160),
  title VARCHAR(300) NOT NULL,
  nature product_nature NOT NULL,
  standard_sell_price NUMERIC(12,2),
  standard_cost NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_balance (
  inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID NOT NULL REFERENCES product_catalog(sku_id) ON DELETE CASCADE,
  location_code VARCHAR(100) NOT NULL DEFAULT 'MAIN',
  on_hand INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  safety_stock INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (sku_id, location_code),
  CHECK (on_hand >= 0), CHECK (reserved >= 0), CHECK (safety_stock >= 0)
);

CREATE TABLE agency_price_book (
  price_book_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES agency_accounts(account_id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_catalog(sku_id) ON DELETE CASCADE,
  contract_price NUMERIC(12,2) NOT NULL,
  minimum_quantity INTEGER NOT NULL DEFAULT 1,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  UNIQUE (account_id, sku_id, effective_from),
  CHECK (contract_price >= 0), CHECK (minimum_quantity > 0)
);

-- Order Management Engine: explicit segregation at the database boundary.
CREATE TABLE agency_orders (
  order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agency_accounts(account_id),
  program_id UUID REFERENCES incentive_programs(program_id) ON DELETE SET NULL,
  order_type order_entry_type NOT NULL,
  status order_fulfillment_status NOT NULL DEFAULT 'STAGED',
  po_reference_number VARCHAR(100) NOT NULL,
  parent_hold_po_id UUID REFERENCES agency_orders(order_id) ON DELETE SET NULL,
  credit_hold_auth_code VARCHAR(100),
  inventory_hold_until TIMESTAMPTZ,
  shipping_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (agency_id, po_reference_number),
  CHECK (
    (order_type = 'REDEMPTION_PO' AND parent_hold_po_id IS NOT NULL)
    OR (order_type <> 'REDEMPTION_PO')
  )
);

CREATE TABLE order_line_items (
  line_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES agency_orders(order_id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_catalog(sku_id),
  quantity_requested INT NOT NULL CHECK (quantity_requested > 0),
  quantity_allocated INT NOT NULL DEFAULT 0,
  quantity_redeemed INT NOT NULL DEFAULT 0,
  unit_contract_price NUMERIC(12,2) NOT NULL,
  shipping_destination_json JSONB,
  CHECK (quantity_allocated >= 0), CHECK (quantity_redeemed >= 0)
);

CREATE TABLE inventory_allocations (
  allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES agency_orders(order_id) ON DELETE CASCADE,
  line_item_id UUID NOT NULL REFERENCES order_line_items(line_item_id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_catalog(sku_id),
  allocation_kind VARCHAR(30) NOT NULL CHECK (allocation_kind IN ('SOFT_HOLD','HARD_COMMIT','REDEMPTION_DRAW')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vendors (
  vendor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code VARCHAR(100) UNIQUE NOT NULL,
  vendor_name VARCHAR(200) NOT NULL,
  status vendor_status NOT NULL DEFAULT 'ACTIVE',
  compliance_status VARCHAR(100),
  master_currency CHAR(3) NOT NULL DEFAULT 'USD',
  payment_terms VARCHAR(80),
  line_of_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  primary_contact_name VARCHAR(150),
  primary_contact_email VARCHAR(250),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vendor_warehouse_locations (
  warehouse_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
  warehouse_name VARCHAR(200) NOT NULL,
  region VARCHAR(100),
  address_json JSONB,
  routing_metadata JSONB,
  api_connection_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vendor_price_book (
  vendor_price_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_catalog(sku_id) ON DELETE CASCADE,
  raw_cost NUMERIC(12,2) NOT NULL,
  minimum_order_quantity INTEGER NOT NULL DEFAULT 1,
  volume_tiers JSONB,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  CHECK (raw_cost >= 0), CHECK (minimum_order_quantity > 0)
);

CREATE TABLE vendor_purchase_orders (
  vendor_po_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(vendor_id),
  purchase_order_reference VARCHAR(100) UNIQUE NOT NULL,
  status vendor_po_status NOT NULL DEFAULT 'DRAFT',
  warehouse_id UUID REFERENCES vendor_warehouse_locations(warehouse_id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ,
  expected_arrival_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  carrier_code VARCHAR(100),
  tracking_number VARCHAR(200),
  shipping_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vendor_purchase_order_lines (
  vendor_po_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_po_id UUID NOT NULL REFERENCES vendor_purchase_orders(vendor_po_id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_catalog(sku_id),
  quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
  quantity_received INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) NOT NULL,
  CHECK (quantity_received >= 0)
);

CREATE TABLE vendor_sla_log (
  sla_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_lead_time_days NUMERIC(8,2),
  actual_lead_time_days NUMERIC(8,2),
  on_time_accuracy_pct NUMERIC(6,3),
  api_dispatch_latency_ms INTEGER,
  sample_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (on_time_accuracy_pct IS NULL OR (on_time_accuracy_pct >= 0 AND on_time_accuracy_pct <= 100))
);

-- Store encrypted material only. Plaintext voucher codes must never be persisted here.
CREATE TABLE digital_voucher_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(vendor_id),
  sku_id UUID NOT NULL REFERENCES product_catalog(sku_id),
  state token_state NOT NULL DEFAULT 'AVAILABLE',
  encrypted_payload BYTEA NOT NULL,
  encryption_key_version VARCHAR(100) NOT NULL,
  masked_reference VARCHAR(100) NOT NULL,
  dispatched_order_id UUID REFERENCES agency_orders(order_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dispatched_at TIMESTAMPTZ
);

CREATE TABLE partner_api_keys (
  api_key_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES agency_accounts(account_id) ON DELETE CASCADE,
  key_prefix VARCHAR(40) NOT NULL,
  secret_hash TEXT NOT NULL,
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('SANDBOX','PRODUCTION')),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ
);

CREATE TABLE webhook_delivery_log (
  webhook_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES agency_accounts(account_id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(vendor_id) ON DELETE SET NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND')),
  event_name VARCHAR(100) NOT NULL,
  endpoint TEXT,
  http_status INTEGER,
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_type_status ON agency_orders(order_type, status);
CREATE INDEX idx_orders_hold_parent ON agency_orders(parent_hold_po_id) WHERE parent_hold_po_id IS NOT NULL;
CREATE INDEX idx_inventory_sku ON inventory_balance(sku_id);
CREATE INDEX idx_vendor_po_status ON vendor_purchase_orders(status, expected_arrival_at);
CREATE INDEX idx_token_state_sku ON digital_voucher_tokens(sku_id, state);
CREATE INDEX idx_sla_vendor_period ON vendor_sla_log(vendor_id, period_end DESC);

-- Production service requirements:
-- 1) Wrap credit checks + inventory allocation + order insert in SERIALIZABLE transactions.
-- 2) Lock inventory rows (SELECT ... FOR UPDATE) before creating Hold/Bulk/Firm allocations.
-- 3) Redemption must lock the parent hold allocation and reject draws above remaining reserved quantity.
-- 4) A scheduled job should expire Hold allocations and release unredeemed quantities.
-- 5) Voucher plaintext should be decrypted only within a trusted server/KMS boundary.
