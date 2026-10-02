-- Stark Supply Chain Intelligence
-- Secure operations suite: CRM, order management, vendors and vendor purchase orders.
-- Apply after 20261001174600_initial_secure_schema.sql.

begin;

create table if not exists public.crm_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  region text not null check (region in ('US', 'EU', 'CA')),
  account_code text not null check (char_length(btrim(account_code)) between 1 and 40),
  account_name text not null check (char_length(btrim(account_name)) between 1 and 180),
  account_name_key text generated always as (lower(btrim(account_name))) stored,
  account_type text not null default 'customer' check (account_type in ('customer', 'prospect', 'partner')),
  account_status text not null default 'active' check (account_status in ('active', 'prospect', 'on_hold', 'inactive')),
  segment text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  billing_address jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null default '{}'::jsonb,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  payment_terms text,
  credit_limit numeric(18,2) not null default 0 check (credit_limit >= 0),
  open_balance numeric(18,2) not null default 0 check (open_balance >= 0),
  last_order_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, region, account_code),
  unique (id, organization_id, region)
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  organization_id uuid not null,
  region text not null check (region in ('US', 'EU', 'CA')),
  activity_type text not null check (activity_type in ('call', 'email', 'meeting', 'note', 'task')),
  subject text not null check (char_length(btrim(subject)) between 1 and 220),
  details text,
  activity_status text not null default 'open' check (activity_status in ('open', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  due_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, organization_id, region)
    references public.crm_accounts(id, organization_id, region) on delete cascade
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  region text not null check (region in ('US', 'EU', 'CA')),
  vendor_code text not null check (char_length(btrim(vendor_code)) between 1 and 40),
  vendor_name text not null check (char_length(btrim(vendor_name)) between 1 and 180),
  vendor_name_key text generated always as (lower(btrim(vendor_name))) stored,
  vendor_status text not null default 'active' check (vendor_status in ('active', 'pending', 'on_hold', 'inactive')),
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  ordering_email text,
  address jsonb not null default '{}'::jsonb,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  payment_terms text,
  incoterm text,
  lead_time_days integer not null default 0 check (lead_time_days between 0 and 3650),
  minimum_order_value numeric(18,2) not null default 0 check (minimum_order_value >= 0),
  shipping_cost_responsibility text not null default 'unknown' check (shipping_cost_responsibility in ('us', 'vendor', 'shared', 'unknown')),
  supports_dropship boolean not null default false,
  supports_pallet boolean not null default false,
  compliance_status text not null default 'pending' check (compliance_status in ('pending', 'approved', 'expired', 'blocked')),
  compliance_expiry date,
  on_time_delivery_pct numeric(5,2) check (on_time_delivery_pct is null or on_time_delivery_pct between 0 and 100),
  quality_score numeric(5,2) check (quality_score is null or quality_score between 0 and 100),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, region, vendor_code),
  unique (id, organization_id, region)
);

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  region text not null check (region in ('US', 'EU', 'CA')),
  order_number text not null check (char_length(btrim(order_number)) between 1 and 60),
  order_type text not null default 'regular' check (order_type in ('event', 'regular')),
  account_id uuid,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 180),
  external_reference text,
  event_name text,
  event_date date,
  order_date date not null default current_date,
  required_date date,
  order_status text not null default 'draft' check (order_status in ('draft', 'confirmed', 'allocated', 'partially_shipped', 'shipped', 'delivered', 'on_hold', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  fulfillment_mode text not null default 'warehouse' check (fulfillment_mode in ('warehouse', 'dropship', 'mixed')),
  shipping_method text,
  shipping_address jsonb not null default '{}'::jsonb,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(18,2) not null default 0 check (subtotal >= 0),
  shipping_amount numeric(18,2) not null default 0 check (shipping_amount >= 0),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(18,2) generated always as (greatest(0, subtotal + shipping_amount + tax_amount - discount_amount)) stored,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, region, order_number),
  unique (id, organization_id, region),
  foreign key (account_id, organization_id, region)
    references public.crm_accounts(id, organization_id, region) on delete set null (account_id),
  check (
    (order_type = 'event' and event_name is not null and btrim(event_name) <> '')
    or (order_type = 'regular' and event_name is null and event_date is null)
  ),
  check (required_date is null or required_date >= order_date)
);

create table if not exists public.sales_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  organization_id uuid not null,
  region text not null check (region in ('US', 'EU', 'CA')),
  line_number integer not null check (line_number > 0),
  model_number text,
  item_description text not null check (char_length(btrim(item_description)) between 1 and 300),
  quantity_ordered numeric(18,3) not null check (quantity_ordered > 0),
  quantity_allocated numeric(18,3) not null default 0 check (quantity_allocated >= 0 and quantity_allocated <= quantity_ordered),
  quantity_shipped numeric(18,3) not null default 0 check (quantity_shipped >= 0 and quantity_shipped <= quantity_ordered),
  unit_price numeric(18,4) not null default 0 check (unit_price >= 0),
  line_total numeric(18,2) generated always as (round(quantity_ordered * unit_price, 2)) stored,
  vendor_id uuid,
  line_status text not null default 'open' check (line_status in ('open', 'allocated', 'backordered', 'partially_shipped', 'shipped', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, line_number),
  unique (id, organization_id, region),
  foreign key (order_id, organization_id, region)
    references public.sales_orders(id, organization_id, region) on delete cascade,
  foreign key (vendor_id, organization_id, region)
    references public.vendors(id, organization_id, region) on delete set null (vendor_id)
);

create table if not exists public.vendor_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  region text not null check (region in ('US', 'EU', 'CA')),
  po_number text not null check (char_length(btrim(po_number)) between 1 and 60),
  po_type text not null check (po_type in ('event', 'inventory', 'dropship')),
  vendor_id uuid not null,
  sales_order_id uuid,
  event_reference text,
  order_date date not null default current_date,
  expected_date date,
  ship_to_type text not null default 'warehouse' check (ship_to_type in ('warehouse', 'customer', 'event_venue')),
  ship_to_address jsonb not null default '{}'::jsonb,
  po_status text not null default 'draft' check (po_status in ('draft', 'submitted', 'acknowledged', 'partial', 'shipped', 'received', 'on_hold', 'cancelled')),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  item_subtotal numeric(18,2) not null default 0 check (item_subtotal >= 0),
  freight_amount numeric(18,2) not null default 0 check (freight_amount >= 0),
  duty_amount numeric(18,2) not null default 0 check (duty_amount >= 0),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(18,2) generated always as (item_subtotal + freight_amount + duty_amount + tax_amount) stored,
  carrier text,
  tracking_number text,
  vendor_confirmation text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, region, po_number),
  unique (id, organization_id, region),
  foreign key (vendor_id, organization_id, region)
    references public.vendors(id, organization_id, region) on delete restrict,
  foreign key (sales_order_id, organization_id, region)
    references public.sales_orders(id, organization_id, region) on delete set null (sales_order_id),
  check (expected_date is null or expected_date >= order_date),
  check (po_type <> 'event' or nullif(btrim(event_reference), '') is not null or sales_order_id is not null),
  check (po_type <> 'dropship' or (sales_order_id is not null and ship_to_type = 'customer'))
);

create table if not exists public.vendor_po_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null,
  organization_id uuid not null,
  region text not null check (region in ('US', 'EU', 'CA')),
  sales_order_line_id uuid,
  line_number integer not null check (line_number > 0),
  model_number text,
  item_description text not null check (char_length(btrim(item_description)) between 1 and 300),
  quantity_ordered numeric(18,3) not null check (quantity_ordered > 0),
  quantity_received numeric(18,3) not null default 0 check (quantity_received >= 0 and quantity_received <= quantity_ordered),
  unit_cost numeric(18,4) not null default 0 check (unit_cost >= 0),
  line_total numeric(18,2) generated always as (round(quantity_ordered * unit_cost, 2)) stored,
  line_status text not null default 'open' check (line_status in ('open', 'confirmed', 'partial', 'received', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_order_id, line_number),
  foreign key (purchase_order_id, organization_id, region)
    references public.vendor_purchase_orders(id, organization_id, region) on delete cascade,
  foreign key (sales_order_line_id, organization_id, region)
    references public.sales_order_lines(id, organization_id, region) on delete set null (sales_order_line_id)
);

create table if not exists public.operations_audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  region text not null check (region in ('US', 'EU', 'CA')),
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  before_data jsonb,
  after_data jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index if not exists crm_accounts_scope_idx on public.crm_accounts(organization_id, region, account_status, account_name_key);
create index if not exists crm_activities_scope_idx on public.crm_activities(organization_id, region, account_id, due_at);
create index if not exists vendors_scope_idx on public.vendors(organization_id, region, vendor_status, vendor_name_key);
create index if not exists sales_orders_scope_idx on public.sales_orders(organization_id, region, order_status, required_date);
create index if not exists sales_orders_account_idx on public.sales_orders(account_id, order_date desc);
create index if not exists sales_order_lines_order_idx on public.sales_order_lines(order_id, line_number);
create index if not exists vendor_pos_scope_idx on public.vendor_purchase_orders(organization_id, region, po_status, expected_date);
create index if not exists vendor_pos_vendor_idx on public.vendor_purchase_orders(vendor_id, order_date desc);
create index if not exists vendor_po_lines_po_idx on public.vendor_po_lines(purchase_order_id, line_number);
create index if not exists operations_audit_scope_idx on public.operations_audit_log(organization_id, region, occurred_at desc);

create or replace function private.stamp_operations_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'An authenticated user is required';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function private.refresh_sales_order_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare target_order uuid := coalesce(new.order_id, old.order_id);
begin
  update public.sales_orders target
  set subtotal = coalesce((select sum(line.line_total) from public.sales_order_lines line where line.order_id = target_order), 0),
      updated_at = now(),
      updated_by = coalesce(auth.uid(), target.updated_by)
  where target.id = target_order;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.refresh_vendor_po_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare target_po uuid := coalesce(new.purchase_order_id, old.purchase_order_id);
begin
  update public.vendor_purchase_orders target
  set item_subtotal = coalesce((select sum(line.line_total) from public.vendor_po_lines line where line.purchase_order_id = target_po), 0),
      updated_at = now(),
      updated_by = coalesce(auth.uid(), target.updated_by)
  where target.id = target_po;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_sales_order_total_after_line on public.sales_order_lines;
create trigger refresh_sales_order_total_after_line
after insert or update or delete on public.sales_order_lines
for each row execute function private.refresh_sales_order_total();

drop trigger if exists refresh_vendor_po_total_after_line on public.vendor_po_lines;
create trigger refresh_vendor_po_total_after_line
after insert or update or delete on public.vendor_po_lines
for each row execute function private.refresh_vendor_po_total();

create or replace function private.write_operations_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare before_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
declare after_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
declare record_row jsonb := coalesce(after_row, before_row);
begin
  insert into public.operations_audit_log (
    organization_id, region, entity_type, entity_id, action, before_data, after_data, actor_id
  ) values (
    (record_row ->> 'organization_id')::uuid,
    record_row ->> 'region',
    tg_table_name,
    (record_row ->> 'id')::uuid,
    lower(tg_op),
    before_row,
    after_row,
    auth.uid()
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'crm_accounts', 'crm_activities', 'vendors', 'sales_orders',
    'sales_order_lines', 'vendor_purchase_orders', 'vendor_po_lines'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || table_name || '_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', 'set_' || table_name || '_updated_at', table_name);
  end loop;

  foreach table_name in array array[
    'crm_accounts', 'crm_activities', 'vendors', 'sales_orders', 'vendor_purchase_orders'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'stamp_' || table_name || '_actor', table_name);
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.stamp_operations_actor()', 'stamp_' || table_name || '_actor', table_name);
  end loop;

  foreach table_name in array array[
    'crm_accounts', 'crm_activities', 'vendors', 'sales_orders',
    'sales_order_lines', 'vendor_purchase_orders', 'vendor_po_lines'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || table_name, table_name);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.write_operations_audit()', 'audit_' || table_name, table_name);
  end loop;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'crm_accounts', 'crm_activities', 'vendors', 'sales_orders',
    'sales_order_lines', 'vendor_purchase_orders', 'vendor_po_lines', 'operations_audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select_member', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_org_member(organization_id))', table_name || '_select_member', table_name);
  end loop;

  foreach table_name in array array[
    'crm_accounts', 'crm_activities', 'vendors', 'sales_orders',
    'sales_order_lines', 'vendor_purchase_orders', 'vendor_po_lines'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_editor', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_edit_org(organization_id))', table_name || '_insert_editor', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_editor', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_edit_org(organization_id)) with check (private.can_edit_org(organization_id))', table_name || '_update_editor', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_editor', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_edit_org(organization_id))', table_name || '_delete_editor', table_name);
  end loop;
end;
$$;

grant select, insert, update, delete on public.crm_accounts to authenticated;
grant select, insert, update, delete on public.crm_activities to authenticated;
grant select, insert, update, delete on public.vendors to authenticated;
grant select, insert, update, delete on public.sales_orders to authenticated;
grant select, insert, update, delete on public.sales_order_lines to authenticated;
grant select, insert, update, delete on public.vendor_purchase_orders to authenticated;
grant select, insert, update, delete on public.vendor_po_lines to authenticated;
grant select on public.operations_audit_log to authenticated;
grant usage, select on sequence public.operations_audit_log_id_seq to authenticated;

alter table public.crm_accounts replica identity full;
alter table public.crm_activities replica identity full;
alter table public.vendors replica identity full;
alter table public.sales_orders replica identity full;
alter table public.vendor_purchase_orders replica identity full;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'crm_accounts', 'crm_activities', 'vendors', 'sales_orders', 'vendor_purchase_orders'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

commit;

select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'crm_accounts', 'crm_activities', 'vendors', 'sales_orders',
    'sales_order_lines', 'vendor_purchase_orders', 'vendor_po_lines', 'operations_audit_log'
  )
order by c.relname;
