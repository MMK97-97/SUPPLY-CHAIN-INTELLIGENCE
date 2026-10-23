-- Apply after the unified workspace, fulfillment and 20261021 task migrations.
-- Email bodies are private organization records. No browser can impersonate a connector.
BEGIN;
-- The Edge connector reads the current document, then writes through the scoped CAS RPC.
GRANT SELECT ON public.stark_unified_workspaces,public.organization_members TO service_role;
CREATE TABLE IF NOT EXISTS public.stark_copilot_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 order_id text NOT NULL, reply_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 owner_user_id uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,order_id)
);
CREATE TABLE IF NOT EXISTS public.stark_copilot_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 order_id text NOT NULL, event_key text NOT NULL CHECK(length(event_key) BETWEEN 1 AND 300),
 message jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,event_key)
);
CREATE TABLE IF NOT EXISTS public.stark_copilot_outreach (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),order_id text NOT NULL,
 request_key text NOT NULL CHECK(length(request_key) BETWEEN 1 AND 200),actor_user_id uuid NOT NULL REFERENCES auth.users(id),
 recipient text NOT NULL,subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 200),body text NOT NULL CHECK(length(body) BETWEEN 1 AND 10000),
 thread_id uuid NOT NULL REFERENCES public.stark_copilot_threads(id),
 state text NOT NULL DEFAULT 'QUEUED' CHECK(state IN ('QUEUED','SENDING','ACCEPTED','UNKNOWN','FAILED')),
 claim_token uuid,lease_until timestamptz,attempts integer NOT NULL DEFAULT 0,provider_id text,accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),last_error text,UNIQUE(organization_id,request_key)
);
CREATE TABLE IF NOT EXISTS public.stark_copilot_alerts (
 organization_id uuid NOT NULL REFERENCES public.organizations(id),order_id text NOT NULL,
 tier text NOT NULL CHECK(tier IN ('Critical','High')),payload jsonb NOT NULL,workspace_revision bigint NOT NULL,
 first_seen_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz,
 PRIMARY KEY(organization_id,order_id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['stark_copilot_threads','stark_copilot_messages','stark_copilot_outreach','stark_copilot_alerts'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('DROP POLICY IF EXISTS copilot_member_read ON public.%I',t);
  EXECUTE format('CREATE POLICY copilot_member_read ON public.%I FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=%I.organization_id AND m.user_id=auth.uid()))',t,t);
 END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS stark_copilot_message_order ON public.stark_copilot_messages(organization_id,order_id,created_at);

CREATE OR REPLACE FUNCTION public.stark_commit_copilot_message(p_organization_id uuid,p_expected_revision bigint,p_order_id text,p_event_key text,p_delta jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE workspace public.stark_unified_workspaces%ROWTYPE; d jsonb; old_order jsonb; updated_order jsonb; msg jsonb; task jsonb; patch jsonb; account_patch jsonb; account_id text; next_revision bigint;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'copilot_service_only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::text,0));
 SELECT * INTO workspace FROM public.stark_unified_workspaces WHERE organization_id=p_organization_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'workspace_not_found'; END IF;
 IF EXISTS(SELECT 1 FROM public.stark_copilot_messages WHERE organization_id=p_organization_id AND event_key=p_event_key AND order_id<>p_order_id) THEN RAISE EXCEPTION 'message_order_conflict'; END IF;
 IF EXISTS(SELECT 1 FROM public.stark_copilot_messages WHERE organization_id=p_organization_id AND event_key=p_event_key) THEN RETURN jsonb_build_object('duplicate',true,'revision',workspace.revision,'document',workspace.document); END IF;
 IF workspace.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'workspace_conflict' USING ERRCODE='40001'; END IF;
 d=workspace.document;SELECT value INTO old_order FROM jsonb_array_elements(d#>'{enterprise,orders}') WHERE value->>'id'=p_order_id;
 IF old_order IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;account_id=old_order->>'accountId';
 msg=p_delta->'message';patch=coalesce(p_delta->'orderPatch','{}');account_patch=coalesce(p_delta->'accountPatch','{}');task=p_delta->'task';
 IF jsonb_typeof(msg) IS DISTINCT FROM 'object' OR coalesce(length(msg->>'id'),0) NOT BETWEEN 1 AND 200 OR coalesce(length(trim(msg->>'text')),0) NOT BETWEEN 1 AND 10000
 OR coalesce(msg->>'direction','') NOT IN ('INBOUND','OUTBOUND') OR jsonb_typeof(msg->'verified') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'invalid_copilot_message'; END IF;
 PERFORM (msg->>'occurredAt')::timestamptz;
 IF (msg->>'occurredAt')::timestamptz>now()+interval '5 minutes' THEN RAISE EXCEPTION 'future_message_time'; END IF;
 IF length(p_event_key) NOT BETWEEN 1 AND 300 OR jsonb_typeof(patch) IS DISTINCT FROM 'object' OR jsonb_typeof(account_patch) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_copilot_delta'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN ('contactStatus','lastContactAt','lastResponseAt','followUpDate','followUpSource','followUpMessageId'))
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(account_patch) k WHERE k NOT IN ('contactStatus','lastCommunicationAt')) THEN RAISE EXCEPTION 'copilot_protected_field'; END IF;
 IF patch ? 'contactStatus' AND patch->>'contactStatus' NOT IN ('Contacted','Responded') THEN RAISE EXCEPTION 'invalid_contact_status'; END IF;
 IF patch ? 'followUpDate' THEN PERFORM (patch->>'followUpDate')::date; END IF;
 IF jsonb_array_length(coalesce(old_order->'communicationLog','[]'))>=1000 THEN RAISE EXCEPTION 'communication_limit'; END IF;
 updated_order=old_order || patch || jsonb_build_object('communicationLog',coalesce(old_order->'communicationLog','[]') || jsonb_build_array(msg));
 d=jsonb_set(d,'{enterprise,orders}',(SELECT jsonb_agg(CASE WHEN value->>'id'=p_order_id THEN updated_order ELSE value END ORDER BY ord) FROM jsonb_array_elements(d#>'{enterprise,orders}') WITH ORDINALITY AS x(value,ord)));
 d=jsonb_set(d,'{enterprise,accounts}',(SELECT jsonb_agg(CASE WHEN value->>'id'=account_id THEN value || account_patch ELSE value END ORDER BY ord) FROM jsonb_array_elements(d#>'{enterprise,accounts}') WITH ORDINALITY AS x(value,ord)));
 IF task IS NOT NULL AND task<>'null'::jsonb THEN
  IF jsonb_typeof(task)<>'object' OR task->>'orderId' IS DISTINCT FROM p_order_id OR task->>'messageId' IS DISTINCT FROM msg->>'id' THEN RAISE EXCEPTION 'invalid_copilot_task'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=p_organization_id AND user_id::text=task->>'ownerUserId') THEN RAISE EXCEPTION 'task_owner_not_in_organization'; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(d->'tasks','[]')) WHERE value->>'id'=task->>'id') THEN
   d=jsonb_set(d,'{tasks}',coalesce(d->'tasks','[]') || jsonb_build_array(task));
  END IF;
 END IF;
 d=jsonb_set(d,'{audit}',(SELECT jsonb_agg(value ORDER BY ord) FROM jsonb_array_elements(jsonb_build_array(jsonb_build_object('id','copilot:'||(msg->>'id'),'time',now(),'action','COPILOT_COMMUNICATION','detail',p_order_id)) || coalesce(d->'audit','[]')) WITH ORDINALITY AS x(value,ord) WHERE ord<=400));
 d=d || jsonb_build_object('revision',coalesce((d->>'revision')::bigint,0)+1,'updatedAt',now());
 IF octet_length(d::text)>10000000 THEN RAISE EXCEPTION 'workspace_size_limit'; END IF;
 INSERT INTO public.stark_copilot_messages(organization_id,order_id,event_key,message) VALUES(p_organization_id,p_order_id,p_event_key,msg);
 next_revision=workspace.revision+1;
 UPDATE public.stark_unified_workspaces SET document=d,revision=next_revision,updated_at=now() WHERE organization_id=p_organization_id;
 RETURN jsonb_build_object('duplicate',false,'revision',next_revision,'document',d,'task',task);
END $$;
REVOKE ALL ON FUNCTION public.stark_commit_copilot_message(uuid,bigint,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stark_commit_copilot_message(uuid,bigint,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.stark_claim_copilot_outreach(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE job public.stark_copilot_outreach%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'copilot_service_only' USING ERRCODE='42501'; END IF;
 SELECT * INTO job FROM public.stark_copilot_outreach WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'outreach_not_found'; END IF;
 IF job.state IN ('ACCEPTED','FAILED') OR (job.state='SENDING' AND job.lease_until>now()) THEN RETURN to_jsonb(job)||jsonb_build_object('claimed',false); END IF;
 IF job.created_at<now()-interval '23 hours' THEN UPDATE public.stark_copilot_outreach SET state='UNKNOWN',last_error='Provider idempotency window requires manual delivery review.' WHERE id=p_id RETURNING * INTO job;RETURN to_jsonb(job)||jsonb_build_object('claimed',false); END IF;
 UPDATE public.stark_copilot_outreach SET state='SENDING',attempts=attempts+1,claim_token=gen_random_uuid(),lease_until=now()+interval '60 seconds' WHERE id=p_id RETURNING * INTO job;
 RETURN to_jsonb(job)||jsonb_build_object('claimed',true);
END $$;
REVOKE ALL ON FUNCTION public.stark_claim_copilot_outreach(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stark_claim_copilot_outreach(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.stark_store_copilot_alerts(p_organization_id uuid,p_revision bigint,p_alerts jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE row jsonb; current_revision bigint;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'copilot_service_only' USING ERRCODE='42501'; END IF;
 SELECT revision INTO current_revision FROM public.stark_unified_workspaces WHERE organization_id=p_organization_id FOR SHARE;
 IF current_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'workspace_conflict' USING ERRCODE='40001'; END IF;
 IF jsonb_typeof(p_alerts)<>'array' OR jsonb_array_length(p_alerts)>10000 THEN RAISE EXCEPTION 'invalid_copilot_alerts'; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(p_alerts) LOOP
  IF coalesce(row->>'orderId','')='' OR row->>'tier' NOT IN ('Critical','High') THEN RAISE EXCEPTION 'invalid_copilot_alert'; END IF;
  INSERT INTO public.stark_copilot_alerts(organization_id,order_id,tier,payload,workspace_revision) VALUES(p_organization_id,row->>'orderId',row->>'tier',row,p_revision)
  ON CONFLICT(organization_id,order_id) DO UPDATE SET tier=EXCLUDED.tier,payload=EXCLUDED.payload,workspace_revision=EXCLUDED.workspace_revision,updated_at=now(),resolved_at=NULL;
 END LOOP;
 UPDATE public.stark_copilot_alerts a SET resolved_at=now(),updated_at=now() WHERE a.organization_id=p_organization_id AND a.resolved_at IS NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_alerts) x WHERE x->>'orderId'=a.order_id);
END $$;
REVOKE ALL ON FUNCTION public.stark_store_copilot_alerts(uuid,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stark_store_copilot_alerts(uuid,bigint,jsonb) TO service_role;

-- Browser saves cannot rewrite connector evidence or manufacture verified mail.
CREATE OR REPLACE FUNCTION public.stark_guard_copilot_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o jsonb; prior jsonb; m jsonb; old_message jsonb; previous_document jsonb;
BEGIN
 IF auth.role()='service_role' THEN RETURN NEW; END IF;
 -- stark_save_workspace uses INSERT ... ON CONFLICT. Its INSERT trigger also
 -- runs for an existing row, before the UPDATE trigger can inspect OLD.
 IF TG_OP='UPDATE' THEN previous_document=OLD.document;
 ELSE SELECT document INTO previous_document FROM public.stark_unified_workspaces WHERE organization_id=NEW.organization_id; END IF;
 FOR o IN SELECT value FROM jsonb_array_elements(NEW.document#>'{enterprise,orders}') LOOP
  SELECT value INTO prior FROM jsonb_array_elements(previous_document#>'{enterprise,orders}') WHERE value->>'id'=o->>'id';
  IF o ? 'communicationLog' AND (jsonb_typeof(o->'communicationLog')<>'array' OR jsonb_array_length(o->'communicationLog')>1000) THEN RAISE EXCEPTION 'invalid_communication_log'; END IF;
  FOR m IN SELECT value FROM jsonb_array_elements(coalesce(o->'communicationLog','[]')) LOOP
   SELECT value INTO old_message FROM jsonb_array_elements(coalesce(prior->'communicationLog','[]')) WHERE value->>'id'=m->>'id';
   IF old_message IS NULL AND (m->>'verified'='true' OR coalesce(m->>'source','manual')<>'manual') THEN RAISE EXCEPTION 'connector_evidence_service_only' USING ERRCODE='42501'; END IF;
   IF old_message IS NOT NULL AND old_message->>'verified'='true' AND old_message IS DISTINCT FROM m THEN RAISE EXCEPTION 'connector_evidence_immutable' USING ERRCODE='42501'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(prior->'communicationLog','[]')) x WHERE x->>'verified'='true' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(o->'communicationLog','[]')) y WHERE y->>'id'=x->>'id')) THEN RAISE EXCEPTION 'connector_evidence_immutable' USING ERRCODE='42501'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.stark_guard_copilot_evidence() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS stark_copilot_evidence_guard ON public.stark_unified_workspaces;
CREATE TRIGGER stark_copilot_evidence_guard BEFORE INSERT OR UPDATE OF document ON public.stark_unified_workspaces FOR EACH ROW EXECUTE FUNCTION public.stark_guard_copilot_evidence();

CREATE TABLE IF NOT EXISTS public.stark_copilot_scan_state (
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),next_scan_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stark_copilot_scan_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stark_copilot_scan_state FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.stark_copilot_scan_state TO service_role;
CREATE OR REPLACE FUNCTION public.stark_claim_copilot_scans(p_limit integer DEFAULT 25) RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'copilot_service_only' USING ERRCODE='42501'; END IF;
 INSERT INTO public.stark_copilot_scan_state(organization_id) SELECT organization_id FROM public.stark_unified_workspaces ON CONFLICT DO NOTHING;
 RETURN QUERY WITH candidates AS (
  SELECT organization_id FROM public.stark_copilot_scan_state WHERE next_scan_at<=now() ORDER BY next_scan_at,organization_id LIMIT least(greatest(coalesce(p_limit,25),1),25) FOR UPDATE SKIP LOCKED
 ) UPDATE public.stark_copilot_scan_state s SET next_scan_at=now()+interval '5 minutes' FROM candidates c WHERE s.organization_id=c.organization_id RETURNING s.organization_id;
END $$;
REVOKE ALL ON FUNCTION public.stark_claim_copilot_scans(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stark_claim_copilot_scans(integer) TO service_role;
COMMIT;
