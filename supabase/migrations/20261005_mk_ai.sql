BEGIN;
-- Usage metadata only. Report rows, prompts, answers and API secrets are not stored here.
CREATE TABLE IF NOT EXISTS public.mk_ai_requests (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS mk_ai_usage_org_time ON public.mk_ai_requests(organization_id, created_at);
ALTER TABLE public.mk_ai_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mk_ai_member_read ON public.mk_ai_requests;
CREATE POLICY mk_ai_member_read ON public.mk_ai_requests FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = mk_ai_requests.organization_id AND m.user_id = auth.uid()));
REVOKE ALL ON public.mk_ai_requests FROM anon, authenticated;
GRANT SELECT ON public.mk_ai_requests TO authenticated;
GRANT ALL ON public.mk_ai_requests TO service_role;

CREATE OR REPLACE FUNCTION public.mk_claim_ai_request(p_organization uuid, p_user uuid, p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- Only the authenticated Edge Function's service-role adapter can claim usage.
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_organization AND user_id = p_user) THEN
    RETURN jsonb_build_object('ok',false,'reason','Organization membership is required.');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_organization::text, 9705));
  IF EXISTS (SELECT 1 FROM public.mk_ai_requests WHERE id = p_request) THEN
    RETURN jsonb_build_object('ok',false,'duplicate',true,'reason','This analysis request has already been started.');
  END IF;
  IF (SELECT count(*) FROM public.mk_ai_requests WHERE organization_id = p_organization AND created_at > now() - interval '1 minute') >= 10 THEN
    RETURN jsonb_build_object('ok',false,'retryAfter',60,'reason','The organization reached 10 analyses per minute.');
  END IF;
  IF (SELECT count(*) FROM public.mk_ai_requests WHERE organization_id = p_organization AND created_at > now() - interval '24 hours') >= 100 THEN
    RETURN jsonb_build_object('ok',false,'retryAfter',3600,'reason','The organization reached 100 analyses in 24 hours.');
  END IF;
  INSERT INTO public.mk_ai_requests(id,organization_id,user_id) VALUES(p_request,p_organization,p_user);
  RETURN jsonb_build_object('ok',true);
END;
$$;
REVOKE ALL ON FUNCTION public.mk_claim_ai_request(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mk_claim_ai_request(uuid,uuid,uuid) TO service_role;
COMMIT;
