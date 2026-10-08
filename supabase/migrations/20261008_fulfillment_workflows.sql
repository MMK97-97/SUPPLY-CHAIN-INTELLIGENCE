-- Extends shared workspace validation for unlisted models in draft/issue orders.
-- Apply after 20261005_unified_system.sql. Existing rows and schema version stay intact.
BEGIN;
CREATE OR REPLACE FUNCTION public.stark_save_workspace(
  p_organization_id uuid, p_expected_revision bigint, p_document jsonb
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE current_revision bigint; next_revision bigint; item jsonb; order_row jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = p_organization_id AND m.user_id = auth.uid()
      AND lower(m.role::text) IN ('owner','admin','editor','manager')
  ) THEN RAISE EXCEPTION 'workspace_access_denied' USING ERRCODE = '42501'; END IF;
  IF p_document IS NULL OR p_document->>'schemaVersion' IS DISTINCT FROM '1'
     OR jsonb_typeof(p_document->'enterprise') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_document->'logistics') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_document->'enterprise'->'orders') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_document->'enterprise'->'inventory') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_document->'enterprise'->'accounts') IS DISTINCT FROM 'array'
     OR octet_length(p_document::text) > 10000000 THEN
    RAISE EXCEPTION 'invalid_workspace_document' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_document->'enterprise'->'inventory') LOOP
    IF coalesce(item->>'sku','') = ''
       OR jsonb_typeof(item->'onHand') IS DISTINCT FROM 'number'
       OR jsonb_typeof(item->'reserved') IS DISTINCT FROM 'number'
       OR jsonb_typeof(item->'damaged') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'invalid_inventory_balance' USING ERRCODE = '22023';
    END IF;
    IF (item->>'onHand')::numeric < 0
       OR (item->>'reserved')::numeric < 0 OR (item->>'damaged')::numeric < 0 THEN
      RAISE EXCEPTION 'invalid_inventory_balance' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  FOR order_row IN SELECT value FROM jsonb_array_elements(p_document->'enterprise'->'orders') LOOP
    IF coalesce(order_row->>'id','') = '' OR coalesce(order_row->>'po','') = ''
       OR jsonb_typeof(order_row->'lines') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'invalid_customer_order' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'enterprise'->'accounts') a WHERE a->>'id' = order_row->>'accountId') THEN
      RAISE EXCEPTION 'invalid_order_account' USING ERRCODE = '22023';
    END IF;
    IF order_row ? 'validation' AND (coalesce(order_row->'validation'->>'state','') NOT IN ('UNVALIDATED','ISSUES','VALIDATED')
      OR (order_row->'validation'->>'state' IN ('UNVALIDATED','ISSUES') AND coalesce(order_row->>'status','') NOT IN ('UNVALIDATED','ISSUES','CANCELLED','EXPIRED'))) THEN
      RAISE EXCEPTION 'invalid_order_validation' USING ERRCODE = '22023';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(order_row->'lines') LOOP
      IF jsonb_typeof(item->'qty') IS DISTINCT FROM 'number' OR jsonb_typeof(item->'price') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'invalid_order_line' USING ERRCODE = '22023';
      END IF;
      IF (item->>'qty')::numeric <= 0 OR (item->>'qty')::numeric <> trunc((item->>'qty')::numeric) OR (item->>'price')::numeric <= 0
         OR (NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'enterprise'->'inventory') i WHERE i->>'sku' = item->>'sku')
           AND NOT (coalesce(order_row->'validation'->>'state','') IN ('UNVALIDATED','ISSUES')
             AND coalesce(order_row->>'status','') IN ('UNVALIDATED','ISSUES','CANCELLED','EXPIRED')
             AND coalesce(item->>'sku','') LIKE 'UNLISTED::%' AND coalesce(item->>'model','') <> '')) THEN
        RAISE EXCEPTION 'invalid_order_line' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END LOOP;
  -- A transaction-level lock covers first creation as well as later saves.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::text,0));
  SELECT revision INTO current_revision FROM public.stark_unified_workspaces
    WHERE organization_id = p_organization_id FOR UPDATE;
  current_revision := coalesce(current_revision,0);
  IF p_expected_revision IS NULL OR p_expected_revision < 0 OR current_revision <> p_expected_revision THEN
    RAISE EXCEPTION 'workspace_conflict' USING ERRCODE = '40001';
  END IF;
  next_revision := current_revision + 1;
  INSERT INTO public.stark_unified_workspaces(organization_id,revision,document,updated_at,updated_by)
    VALUES(p_organization_id,next_revision,p_document,now(),auth.uid())
  ON CONFLICT(organization_id) DO UPDATE SET revision=excluded.revision,
    document=excluded.document, updated_at=excluded.updated_at, updated_by=excluded.updated_by;
  RETURN next_revision;
END;
$$;
REVOKE ALL ON FUNCTION public.stark_save_workspace(uuid,bigint,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stark_save_workspace(uuid,bigint,jsonb) TO authenticated;

CREATE TABLE IF NOT EXISTS public.stark_3pl_deliveries (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  request_id text NOT NULL CHECK (request_id ~ '^3plreq_[A-Za-z0-9_-]{1,120}$'),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK (state IN ('SENDING','ACKNOWLEDGED','REJECTED','UNKNOWN')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 5),
  remote_order_id text,
  sent_at timestamptz,
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,request_id)
);
ALTER TABLE public.stark_3pl_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stark_3pl_member_read ON public.stark_3pl_deliveries;
CREATE POLICY stark_3pl_member_read ON public.stark_3pl_deliveries FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id=stark_3pl_deliveries.organization_id AND m.user_id=auth.uid())
);
REVOKE ALL ON public.stark_3pl_deliveries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.stark_3pl_deliveries TO authenticated;
GRANT ALL ON public.stark_3pl_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.stark_claim_3pl_delivery(
  p_organization_id uuid,p_request_id text,p_payload_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE existing public.stark_3pl_deliveries; claimed boolean:=false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'server_access_required' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL OR p_request_id !~ '^3plreq_[A-Za-z0-9_-]{1,120}$'
     OR p_payload_hash IS NULL OR p_payload_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_delivery_request' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_request_id,0));
  SELECT * INTO existing FROM public.stark_3pl_deliveries
    WHERE organization_id=p_organization_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.stark_3pl_deliveries(organization_id,request_id,payload_hash,state)
      VALUES(p_organization_id,p_request_id,p_payload_hash,'SENDING') RETURNING * INTO existing;
    claimed:=true;
  ELSE
    IF existing.payload_hash<>p_payload_hash THEN
      RAISE EXCEPTION 'delivery_payload_changed' USING ERRCODE='22023';
    END IF;
    IF existing.state='REJECTED' AND existing.attempts<5 THEN
      UPDATE public.stark_3pl_deliveries SET state='SENDING',attempts=attempts+1,error='',updated_at=now()
        WHERE organization_id=p_organization_id AND request_id=p_request_id RETURNING * INTO existing;
      claimed:=true;
    END IF;
  END IF;
  RETURN jsonb_build_object('claimed',claimed,'state',existing.state,
    'remote_order_id',existing.remote_order_id,'sent_at',existing.sent_at,'error',existing.error);
END;
$$;
REVOKE ALL ON FUNCTION public.stark_claim_3pl_delivery(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stark_claim_3pl_delivery(uuid,text,text) TO service_role;
COMMIT;
