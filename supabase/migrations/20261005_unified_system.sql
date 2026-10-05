-- Optional organization-scoped shared state for the static unified workspace.
-- Requires the existing organizations and organization_members tables used by
-- assets/supabase-auth.js. Run in the same Supabase project as existing login.
-- This migration does not modify the prior business tables or auth settings.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.organizations') IS NULL OR to_regclass('public.organization_members') IS NULL THEN
    RAISE EXCEPTION 'Existing organizations and organization_members tables are required. Complete the existing authentication setup first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.stark_unified_workspaces (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  document jsonb NOT NULL CHECK (document->>'schemaVersion' IS NOT DISTINCT FROM '1'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE public.stark_unified_workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stark_workspace_member_read ON public.stark_unified_workspaces;
CREATE POLICY stark_workspace_member_read ON public.stark_unified_workspaces
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.organization_members m
          WHERE m.organization_id = stark_unified_workspaces.organization_id
            AND m.user_id = auth.uid())
);
REVOKE ALL ON public.stark_unified_workspaces FROM anon, authenticated;
GRANT SELECT ON public.stark_unified_workspaces TO authenticated;

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
    FOR item IN SELECT value FROM jsonb_array_elements(order_row->'lines') LOOP
      IF jsonb_typeof(item->'qty') IS DISTINCT FROM 'number' OR jsonb_typeof(item->'price') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'invalid_order_line' USING ERRCODE = '22023';
      END IF;
      IF (item->>'qty')::numeric <= 0 OR (item->>'qty')::numeric <> trunc((item->>'qty')::numeric) OR (item->>'price')::numeric <= 0
         OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_document->'enterprise'->'inventory') i WHERE i->>'sku' = item->>'sku') THEN
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
COMMIT;
