-- ============================================================
-- WAREHOUSE MANAGEMENT SYSTEM (WMS)
-- Extends the supplied bin + warehouse-inventory model with
-- receiving, putaway, waves, packing, movements and cycle counts.
-- ============================================================
CREATE TABLE warehouse_facilities (
  warehouse_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_code VARCHAR(40) UNIQUE NOT NULL,
  warehouse_name VARCHAR(160) NOT NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'America/New_York',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','HOLD','CLOSED')),
  dock_door_count INTEGER NOT NULL DEFAULT 0 CHECK (dock_door_count >= 0),
  shipping_cutoff TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_bins (
  bin_id VARCHAR(50) PRIMARY KEY,
  warehouse_id UUID REFERENCES warehouse_facilities(warehouse_id) ON DELETE CASCADE,
  zone VARCHAR(50) NOT NULL,
  aisle VARCHAR(50),
  rack VARCHAR(50),
  level_code VARCHAR(50),
  max_weight_kg NUMERIC(10,2),
  capacity_units INTEGER CHECK (capacity_units IS NULL OR capacity_units >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE warehouse_inventory (
  warehouse_inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouse_facilities(warehouse_id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  bin_id VARCHAR(50) REFERENCES inventory_bins(bin_id),
  qty_on_hand INTEGER NOT NULL DEFAULT 0,
  qty_reserved INTEGER NOT NULL DEFAULT 0,
  qty_damaged INTEGER NOT NULL DEFAULT 0,
  serialized BOOLEAN NOT NULL DEFAULT FALSE,
  lot_controlled BOOLEAN NOT NULL DEFAULT FALSE,
  last_counted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (warehouse_id, sku, bin_id),
  CHECK (qty_on_hand >= 0),
  CHECK (qty_reserved >= 0),
  CHECK (qty_damaged >= 0),
  CHECK (qty_on_hand >= qty_reserved)
);

CREATE TABLE warehouse_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouse_facilities(warehouse_id),
  vendor_po_id UUID REFERENCES vendor_purchase_orders(vendor_po_id) ON DELETE SET NULL,
  asn_reference VARCHAR(100),
  dock_door VARCHAR(30),
  appointment_at TIMESTAMPTZ,
  carrier VARCHAR(120),
  status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','ARRIVED','RECEIVING','RECEIVED','PUTAWAY','CLOSED','EXCEPTION')),
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE warehouse_receipt_lines (
  receipt_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES warehouse_receipts(receipt_id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  quantity_expected INTEGER NOT NULL DEFAULT 0,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  quantity_damaged INTEGER NOT NULL DEFAULT 0,
  serial_numbers JSONB,
  CHECK (quantity_expected >= 0 AND quantity_received >= 0 AND quantity_damaged >= 0)
);

CREATE TABLE vendor_invoices (
  vendor_invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_po_id UUID REFERENCES vendor_purchase_orders(vendor_po_id) ON DELETE SET NULL,
  invoice_reference VARCHAR(100) NOT NULL,
  invoice_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (invoice_reference)
);

CREATE TABLE vendor_po_reconciliation (
  reconciliation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_po_id UUID NOT NULL REFERENCES vendor_purchase_orders(vendor_po_id) ON DELETE CASCADE,
  receipt_id UUID REFERENCES warehouse_receipts(receipt_id) ON DELETE SET NULL,
  vendor_invoice_id UUID REFERENCES vendor_invoices(vendor_invoice_id) ON DELETE SET NULL,
  quantity_match BOOLEAN NOT NULL DEFAULT FALSE,
  price_match BOOLEAN NOT NULL DEFAULT FALSE,
  invoice_match BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','MATCHED','RECONCILIATION_EXCEPTION','APPROVED')),
  exception_detail JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE putaway_tasks (
  putaway_task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_line_id UUID NOT NULL REFERENCES warehouse_receipt_lines(receipt_line_id) ON DELETE CASCADE,
  from_bin_id VARCHAR(50) REFERENCES inventory_bins(bin_id),
  to_bin_id VARCHAR(50) REFERENCES inventory_bins(bin_id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  assignee_user_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETE','EXCEPTION')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE warehouse_pick_waves (
  wave_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouse_facilities(warehouse_id),
  wave_reference VARCHAR(60) UNIQUE NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  status VARCHAR(20) NOT NULL DEFAULT 'READY' CHECK (status IN ('READY','PICKING','COMPLETE','CANCELLED')),
  picker_user_id UUID,
  released_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE warehouse_pick_wave_lines (
  wave_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id UUID NOT NULL REFERENCES warehouse_pick_waves(wave_id) ON DELETE CASCADE,
  order_id UUID REFERENCES agency_orders(order_id) ON DELETE SET NULL,
  sku VARCHAR(100) NOT NULL,
  bin_id VARCHAR(50) REFERENCES inventory_bins(bin_id),
  quantity_required INTEGER NOT NULL CHECK (quantity_required > 0),
  quantity_picked INTEGER NOT NULL DEFAULT 0 CHECK (quantity_picked >= 0)
);

CREATE TABLE warehouse_pack_jobs (
  pack_job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES agency_orders(order_id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES warehouse_facilities(warehouse_id),
  carton_reference VARCHAR(100),
  carrier_code VARCHAR(80),
  service_level VARCHAR(80),
  tracking_number VARCHAR(160),
  pack_slip_brand VARCHAR(160),
  white_label BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(30) NOT NULL DEFAULT 'PACKED' CHECK (status IN ('PACKED','LABEL_CREATED','SHIPPED','EXCEPTION')),
  shipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE warehouse_stock_movements (
  movement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouse_facilities(warehouse_id),
  sku VARCHAR(100) NOT NULL,
  movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('RECEIVING','PUTAWAY','TRANSFER','ALLOCATION','PICK','PACK','SHIP','ADJUSTMENT','CYCLE_COUNT')),
  quantity_delta INTEGER NOT NULL,
  from_bin_id VARCHAR(50),
  to_bin_id VARCHAR(50),
  reference_type VARCHAR(50),
  reference_id VARCHAR(100),
  actor_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE warehouse_cycle_counts (
  cycle_count_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouse_facilities(warehouse_id),
  bin_id VARCHAR(50) REFERENCES inventory_bins(bin_id),
  sku VARCHAR(100) NOT NULL,
  system_quantity INTEGER NOT NULL,
  counted_quantity INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','VARIANCE','COMPLETE','APPROVED')),
  reason VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- THIRD-PARTY LOGISTICS (3PL) MANAGEMENT
-- Dynamic routing, external inventory mirror, shipment requests,
-- nightly reconciliation and >24 hour dispatch escalation.
-- ============================================================
CREATE TABLE three_pl_nodes (
  node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_code VARCHAR(60) UNIQUE NOT NULL,
  node_name VARCHAR(160) NOT NULL,
  region VARCHAR(30) NOT NULL,
  city VARCHAR(100),
  state_region VARCHAR(100),
  country_code CHAR(2) NOT NULL DEFAULT 'US',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','WATCH','SUSPENDED')),
  integration_key_hash TEXT,
  ack_sla_minutes INTEGER NOT NULL DEFAULT 15,
  dispatch_sla_hours INTEGER NOT NULL DEFAULT 24,
  base_handling_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  last_inventory_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE three_pl_inventory (
  three_pl_inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES three_pl_nodes(node_id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  quantity_reported INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  internal_registry_quantity INTEGER NOT NULL DEFAULT 0,
  variation_supported BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (node_id, sku),
  CHECK (quantity_reported >= 0 AND quantity_reserved >= 0)
);

CREATE TABLE three_pl_shipment_requests (
  shipment_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_order_id UUID REFERENCES agency_orders(order_id) ON DELETE SET NULL,
  node_id UUID NOT NULL REFERENCES three_pl_nodes(node_id),
  warehouse_sku VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  shipping_tier VARCHAR(80) NOT NULL,
  recipient_json JSONB NOT NULL,
  route_score NUMERIC(6,2),
  estimated_cost NUMERIC(12,2),
  status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','ACCEPTED','PICKING','DISPATCHED','DELIVERED','DELAYED','EXCEPTION','CANCELLED')),
  external_reference VARCHAR(160),
  tracking_number VARCHAR(160),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE three_pl_reconciliation_log (
  reconciliation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES three_pl_nodes(node_id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  internal_registry_quantity INTEGER NOT NULL,
  node_reported_quantity INTEGER NOT NULL,
  variance INTEGER GENERATED ALWAYS AS (node_reported_quantity - internal_registry_quantity) STORED,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','REVIEW','CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE three_pl_sla_log (
  sla_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES three_pl_nodes(node_id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  on_time_dispatch_pct NUMERIC(6,3),
  inventory_accuracy_pct NUMERIC(6,3),
  average_ack_minutes NUMERIC(10,2),
  orders_over_24h INTEGER NOT NULL DEFAULT 0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wms_inventory_sku_bin ON warehouse_inventory(sku, bin_id);
CREATE INDEX idx_wms_receipts_status_appt ON warehouse_receipts(status, appointment_at);
CREATE INDEX idx_wms_putaway_status ON putaway_tasks(status, priority);
CREATE INDEX idx_wms_wave_status ON warehouse_pick_waves(status, created_at);
CREATE INDEX idx_wms_movement_sku_time ON warehouse_stock_movements(sku, created_at DESC);
CREATE INDEX idx_3pl_inventory_node_sku ON three_pl_inventory(node_id, sku);
CREATE INDEX idx_3pl_ship_status_time ON three_pl_shipment_requests(status, requested_at);
CREATE INDEX idx_3pl_recon_status ON three_pl_reconciliation_log(status, created_at DESC);

-- Suggested scheduled controls:
-- * every 15-60 minutes: pull/sync 3PL inventory balances and write three_pl_inventory.
-- * nightly: compare node balances to internal_registry_quantity and create reconciliation exceptions.
-- * hourly: mark un-dispatched 3PL shipments older than node dispatch_sla_hours as DELAYED and escalate.
-- * warehouse receiving: reconcile vendor PO + receipt + invoice before AP approval.
