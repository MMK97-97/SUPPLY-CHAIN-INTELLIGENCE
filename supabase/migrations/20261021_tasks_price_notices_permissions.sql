-- Apply after 20261005_unified_system.sql and 20261008_fulfillment_workflows.sql.
-- No credentials belong in this migration. Existing organization memberships are retained.
BEGIN;
CREATE TABLE IF NOT EXISTS public.stark_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  event_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('PRICE_CHANGE','TASK_REMINDER')),
  account_id text, task_id text,
  recipient text NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'QUEUED' CHECK (state IN ('QUEUED','SENDING','RETRY','ACCEPTED','FAILED','SKIPPED','UNKNOWN')),
  attempts integer NOT NULL DEFAULT 0,
  claim_token uuid, lease_until timestamptz, first_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
  provider_id text, last_error text,
  UNIQUE (organization_id,event_key,recipient)
);
CREATE INDEX IF NOT EXISTS stark_notice_pending ON public.stark_notification_outbox(next_attempt_at) WHERE state IN ('QUEUED','RETRY','SENDING');
ALTER TABLE public.stark_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stark_notification_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.stark_notification_outbox TO authenticated;
GRANT ALL ON public.stark_notification_outbox TO service_role;
DROP POLICY IF EXISTS stark_notice_members ON public.stark_notification_outbox;
CREATE POLICY stark_notice_members ON public.stark_notification_outbox FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=stark_notification_outbox.organization_id AND m.user_id=auth.uid())
);

CREATE OR REPLACE FUNCTION public.stark_guard_workspace_actions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE prior jsonb; item jsonb; old_item jsonb; preferences jsonb; order_list jsonb='[]'::jsonb; task_list jsonb='[]'::jsonb; permitted boolean; ids text[]='{}';
BEGIN
 IF TG_OP='UPDATE' THEN prior=OLD.document; ELSE SELECT document INTO prior FROM public.stark_unified_workspaces WHERE organization_id=NEW.organization_id; prior=coalesce(prior,'{}'::jsonb); END IF;
 permitted=EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=NEW.organization_id AND m.user_id=auth.uid() AND lower(m.role::text) IN ('owner','admin','manager')) OR auth.role()='service_role';
 FOR item IN SELECT value FROM jsonb_array_elements(NEW.document#>'{enterprise,orders}') LOOP
  SELECT value INTO old_item FROM jsonb_array_elements(coalesce(prior#>'{enterprise,orders}','[]')) WHERE value->>'id'=item->>'id';
  IF item->>'id'=ANY(ids) THEN RAISE EXCEPTION 'duplicate_order_id' USING ERRCODE='22023'; END IF; ids=array_append(ids,item->>'id');
  IF ((upper(item->>'status')='CANCELLED' AND coalesce(old_item->>'status','')<>'CANCELLED') OR (old_item->>'status'='CANCELLED' AND item->>'status'<>'CANCELLED')) AND NOT coalesce(permitted,false) THEN
   RAISE EXCEPTION 'order_cancellation_permission_required' USING ERRCODE='42501';
  END IF;
  IF old_item IS NOT NULL AND coalesce(old_item#>>'{validation,state}','VALIDATED')='VALIDATED' AND item#>>'{validation,state}' IN ('UNVALIDATED','ISSUES') AND NOT coalesce(permitted,false) THEN
   RAISE EXCEPTION 'order_cancellation_permission_required' USING ERRCODE='42501';
  END IF;
  IF item->>'status'='CANCELLED' AND old_item->>'status'='CANCELLED' THEN
   item=item || jsonb_build_object('cancelledBy',old_item->'cancelledBy','cancelledAt',old_item->'cancelledAt');
  ELSIF item->>'status'='CANCELLED' AND coalesce(old_item->>'status','')<>'CANCELLED' THEN
   item=item || jsonb_build_object('cancelledBy',auth.uid(),'cancelledAt',now());
  END IF;
  order_list=order_list || jsonb_build_array(item);
 END LOOP;
 IF NOT coalesce(permitted,false) AND EXISTS(
  SELECT 1 FROM jsonb_array_elements(coalesce(prior#>'{enterprise,orders}','[]')) old_order
  WHERE NOT (coalesce(old_order#>>'{validation,state}','VALIDATED') IN ('UNVALIDATED','ISSUES'))
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(order_list) new_order WHERE new_order->>'id'=old_order->>'id')
 ) THEN RAISE EXCEPTION 'order_cancellation_permission_required' USING ERRCODE='42501'; END IF;
 NEW.document=jsonb_set(NEW.document,'{enterprise,orders}',order_list);
 FOR item IN SELECT value FROM jsonb_array_elements(NEW.document#>'{enterprise,accounts}') LOOP
  preferences=item->'priceNotifications';
  IF preferences IS NOT NULL THEN
   IF jsonb_typeof(preferences)<>'object' OR (preferences ? 'enabled' AND jsonb_typeof(preferences->'enabled')<>'boolean') THEN RAISE EXCEPTION 'invalid_price_notification_settings'; END IF;
   IF preferences ? 'emails' THEN
    IF jsonb_typeof(preferences->'emails')<>'array' OR jsonb_array_length(preferences->'emails')>10 THEN RAISE EXCEPTION 'invalid_price_notification_recipients'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(preferences->'emails') email WHERE jsonb_typeof(email)<>'string') THEN RAISE EXCEPTION 'invalid_price_notification_recipients'; END IF;
   END IF;
   IF preferences ? 'brands' THEN
    IF jsonb_typeof(preferences->'brands')<>'array' OR jsonb_array_length(preferences->'brands')>100 THEN RAISE EXCEPTION 'invalid_price_notification_brands'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(preferences->'brands') brand WHERE jsonb_typeof(brand)<>'string') THEN RAISE EXCEPTION 'invalid_price_notification_brands'; END IF;
   END IF;
  END IF;
 END LOOP;

 IF NEW.document ? 'tasks' THEN
  IF jsonb_typeof(NEW.document->'tasks')<>'array' OR jsonb_array_length(NEW.document->'tasks')>10000 THEN RAISE EXCEPTION 'invalid_tasks'; END IF;
  ids='{}';
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.document->'tasks') LOOP
   IF coalesce(item->>'id','')='' OR item->>'id'=ANY(ids) OR coalesce(length(trim(item->>'title')),0) NOT BETWEEN 1 AND 160
    OR jsonb_typeof(item->'notes') IS DISTINCT FROM 'string' OR length(item->>'notes')>20000
    OR coalesce(item->>'status','') NOT IN ('OPEN','IN_PROGRESS','DONE') OR coalesce(item->>'priority','') NOT IN ('LOW','NORMAL','HIGH')
    OR jsonb_typeof(item->'comments') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'comments')>200 THEN RAISE EXCEPTION 'invalid_task'; END IF;
   ids=array_append(ids,item->>'id');
   IF nullif(item->>'reminderAt','') IS NOT NULL AND nullif(item->>'dueAt','') IS NOT NULL AND (item->>'reminderAt')::timestamptz>(item->>'dueAt')::timestamptz THEN RAISE EXCEPTION 'invalid_task_reminder'; END IF;
   IF nullif(item->>'reminderAt','') IS NOT NULL THEN PERFORM (item->>'reminderAt')::timestamptz; END IF;
   IF nullif(item->>'dueAt','') IS NOT NULL THEN PERFORM (item->>'dueAt')::timestamptz; END IF;
   SELECT value INTO old_item FROM jsonb_array_elements(coalesce(prior->'tasks','[]')) WHERE value->>'id'=item->>'id';
   IF old_item IS NULL AND coalesce(item->>'ownerUserId','local') NOT IN ('local',coalesce(auth.uid()::text,'')) AND auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'task_owner_permission_required' USING ERRCODE='42501'; END IF;
   IF old_item IS NOT NULL AND coalesce(old_item->>'ownerUserId','local') IS DISTINCT FROM coalesce(item->>'ownerUserId','local') AND auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'task_owner_cannot_change' USING ERRCODE='42501'; END IF;
   task_list=task_list || jsonb_build_array(item);
  END LOOP;
  NEW.document=jsonb_set(NEW.document,'{tasks}',task_list);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.stark_guard_workspace_actions() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS stark_workspace_action_guard ON public.stark_unified_workspaces;
CREATE TRIGGER stark_workspace_action_guard BEFORE INSERT OR UPDATE OF document ON public.stark_unified_workspaces FOR EACH ROW EXECUTE FUNCTION public.stark_guard_workspace_actions();

-- Produce notices from committed server data, rather than accepting an email body from a browser.
CREATE OR REPLACE FUNCTION public.stark_changed_prices(before_doc jsonb,after_doc jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE item jsonb; previous jsonb; patch jsonb; old_patch jsonb; result jsonb='[]'; change jsonb; item_currency text;
BEGIN
 IF after_doc#>'{enterprise,catalogUpdates}' IS NOT NULL AND jsonb_typeof(after_doc#>'{enterprise,catalogUpdates}')<>'array' THEN RAISE EXCEPTION 'invalid_catalog_updates'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(coalesce(after_doc#>'{enterprise,catalogUpdates}','[]')) LOOP
  patch=item->'patch';
  IF (patch ? 'priceNet' AND (jsonb_typeof(patch->'priceNet')<>'number' OR (patch->>'priceNet')::numeric<0)) OR (patch ? 'standardPrice' AND (jsonb_typeof(patch->'standardPrice')<>'number' OR (patch->>'standardPrice')::numeric<0)) THEN RAISE EXCEPTION 'invalid_catalog_price'; END IF;
  SELECT value INTO previous FROM jsonb_array_elements(coalesce(before_doc#>'{enterprise,catalogUpdates}','[]')) old_item WHERE old_item->>'sku'=item->>'sku' AND old_item->>'region'=item->>'region' AND old_item->>'brand'=item->>'brand';
  old_patch=previous->'patch';
  IF (patch->'priceNet' IS NOT NULL AND patch->'priceNet' IS DISTINCT FROM old_patch->'priceNet') OR (patch->'standardPrice' IS NOT NULL AND patch->'standardPrice' IS DISTINCT FROM old_patch->'standardPrice') THEN
   item_currency=coalesce(patch->>'currency',CASE item->>'region' WHEN 'EU' THEN 'EUR' WHEN 'CA' THEN 'CAD' ELSE 'USD' END);
   change=jsonb_build_object('kind','CATALOG','sku',item->>'sku','model',item->>'model','brand',item->>'brand','currency',item_currency,
    'netPrice',patch->'priceNet','previousNet',old_patch->'priceNet','retailPrice',patch->'standardPrice','previousRetail',old_patch->'standardPrice');
   result=result || jsonb_build_array(change);
  END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(after_doc#>'{enterprise,inventory}') LOOP
  SELECT value INTO previous FROM jsonb_array_elements(before_doc#>'{enterprise,inventory}') old_item WHERE old_item->>'sku'=item->>'sku';
  IF previous IS NULL THEN CONTINUE; END IF;
  IF coalesce(item->'priceNet',item->'standardPrice') IS DISTINCT FROM coalesce(previous->'priceNet',previous->'standardPrice') OR item->'retailPrice' IS DISTINCT FROM previous->'retailPrice' THEN
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(result) c WHERE lower(c->>'brand')=lower(item->>'brand') AND regexp_replace(lower(c->>'model'),'[-[:space:]]','','g')=regexp_replace(lower(item->>'model'),'[-[:space:]]','','g') AND c->'netPrice'=coalesce(item->'priceNet',item->'standardPrice')) THEN CONTINUE; END IF;
   item_currency=coalesce(item->>'currency',CASE item->>'region' WHEN 'EU' THEN 'EUR' WHEN 'CA' THEN 'CAD' ELSE 'USD' END);
   result=result || jsonb_build_array(jsonb_build_object('kind','CATALOG','sku',item->>'sku','model',item->>'model','brand',item->>'brand','currency',item_currency,
    'netPrice',coalesce(item->'priceNet',item->'standardPrice'),'previousNet',coalesce(previous->'priceNet',previous->'standardPrice'),'retailPrice',item->'retailPrice','previousRetail',previous->'retailPrice'));
  END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(coalesce(after_doc#>'{enterprise,priceOverrides}','[]')) LOOP
  SELECT value INTO previous FROM jsonb_array_elements(coalesce(before_doc#>'{enterprise,priceOverrides}','[]')) old_item WHERE old_item->>'id'=item->>'id';
  IF previous IS NOT NULL AND item->'price' IS NOT DISTINCT FROM previous->'price' AND item->'minQty' IS NOT DISTINCT FROM previous->'minQty' AND item->'effective' IS NOT DISTINCT FROM previous->'effective' AND item->>'sku' IS NOT DISTINCT FROM previous->>'sku' AND item->>'accountId' IS NOT DISTINCT FROM previous->>'accountId' THEN CONTINUE; END IF;
  IF jsonb_typeof(item->'price') IS DISTINCT FROM 'number' OR (item->>'price')::numeric<0 THEN RAISE EXCEPTION 'invalid_contract_price'; END IF;
  SELECT value INTO previous FROM jsonb_array_elements(after_doc#>'{enterprise,inventory}') inventory WHERE inventory->>'sku'=item->>'sku';
  SELECT coalesce(a->>'currency','USD') INTO item_currency FROM jsonb_array_elements(after_doc#>'{enterprise,accounts}') a WHERE a->>'id'=item->>'accountId';
  result=result || jsonb_build_array(jsonb_build_object('kind','CONTRACT','currency',item_currency,'accountId',item->>'accountId','sku',item->>'sku','model',previous->>'model','brand',previous->>'brand','netPrice',item->'price','minQty',item->'minQty','effective',item->>'effective'));
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(coalesce(before_doc#>'{enterprise,priceOverrides}','[]')) LOOP
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(after_doc#>'{enterprise,priceOverrides}','[]')) p WHERE p->>'id'=item->>'id' AND p->>'accountId'=item->>'accountId' AND p->>'sku'=item->>'sku') THEN CONTINUE; END IF;
  SELECT value INTO previous FROM jsonb_array_elements(after_doc#>'{enterprise,inventory}') i WHERE i->>'sku'=item->>'sku';
  SELECT coalesce(a->>'currency','USD') INTO item_currency FROM jsonb_array_elements(after_doc#>'{enterprise,accounts}') a WHERE a->>'id'=item->>'accountId';
  result=result || jsonb_build_array(jsonb_build_object('kind','CONTRACT_REMOVED','accountId',item->>'accountId','sku',item->>'sku','model',previous->>'model','brand',previous->>'brand','netPrice',coalesce(previous->'priceNet',previous->'standardPrice'),'currency',item_currency));
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.stark_changed_prices(jsonb,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.stark_price_recipients(account jsonb) RETURNS SETOF text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT DISTINCT lower(trim(value)) FROM jsonb_array_elements_text(
  jsonb_build_array(coalesce(account->>'email','')) || CASE WHEN jsonb_typeof(account#>'{priceNotifications,emails}')='array' THEN account#>'{priceNotifications,emails}' ELSE '[]'::jsonb END
 ) WHERE value ~ '^[^[:space:]@,]+@[^[:space:]@,]+\.[^[:space:]@,]+$'
 AND lower(value) !~ '\.(example|test|invalid|localhost)$';
$$;
REVOKE ALL ON FUNCTION public.stark_price_recipients(jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.stark_queue_price_notices() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE changes jsonb; account jsonb; account_changes jsonb; recipient text;
BEGIN
 IF NEW.document->>'mode' IS DISTINCT FROM 'working' THEN RETURN NEW; END IF;
 changes=public.stark_changed_prices(OLD.document,NEW.document);
 IF jsonb_array_length(changes)=0 THEN RETURN NEW; END IF;
 FOR account IN SELECT value FROM jsonb_array_elements(NEW.document#>'{enterprise,accounts}') LOOP
  IF account->>'status'<>'ACTIVE' OR account#>'{priceNotifications,enabled}'='false'::jsonb THEN CONTINUE; END IF;
  SELECT coalesce(jsonb_agg(change),'[]') INTO account_changes FROM jsonb_array_elements(changes) change WHERE
   ((change->>'kind' IN ('CONTRACT','CONTRACT_REMOVED') AND change->>'accountId' IN (account->>'id',account->>'parentId') AND upper(change->>'currency')=upper(coalesce(account->>'currency','USD'))) OR
    (change->>'kind'='CATALOG' AND upper(change->>'currency')=upper(coalesce(account->>'currency','USD')))) AND
   (jsonb_typeof(account#>'{priceNotifications,brands}') IS DISTINCT FROM 'array' OR jsonb_array_length(account#>'{priceNotifications,brands}')=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(account#>'{priceNotifications,brands}') brand WHERE lower(brand)=lower(change->>'brand')));
  IF jsonb_array_length(account_changes)=0 THEN CONTINUE; END IF;
  FOR recipient IN SELECT public.stark_price_recipients(account) LOOP
   INSERT INTO public.stark_notification_outbox(organization_id,event_key,kind,account_id,recipient,payload)
   VALUES(NEW.organization_id,'price:'||NEW.revision||':'||(account->>'id'),'PRICE_CHANGE',account->>'id',recipient,
    jsonb_build_object('customerName',account->>'name','currency',coalesce(account->>'currency','USD'),'changes',account_changes,'changedAt',now()))
   ON CONFLICT DO NOTHING;
  END LOOP;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.stark_queue_price_notices() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS stark_workspace_price_notices ON public.stark_unified_workspaces;
CREATE TRIGGER stark_workspace_price_notices AFTER UPDATE OF document ON public.stark_unified_workspaces FOR EACH ROW EXECUTE FUNCTION public.stark_queue_price_notices();

-- Only the Edge Function's service client can claim deliveries. SKIP LOCKED and leases
-- make scheduled calls and immediate app calls safe to run at the same time.
CREATE OR REPLACE FUNCTION public.stark_claim_notifications(p_organization_id uuid DEFAULT NULL,p_limit integer DEFAULT 20)
RETURNS SETOF public.stark_notification_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE workspace record; task jsonb; account jsonb; item public.stark_notification_outbox; address text; owner_id uuid; doc jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'notification_service_only' USING ERRCODE='42501'; END IF;
 FOR workspace IN SELECT organization_id,document FROM public.stark_unified_workspaces WHERE (p_organization_id IS NULL OR organization_id=p_organization_id) AND document->>'mode'='working' LOOP
  FOR task IN SELECT value FROM jsonb_array_elements(coalesce(workspace.document->'tasks','[]')) LOOP
   IF task->>'status'='DONE' OR nullif(task->>'reminderAt','') IS NULL OR (task->>'reminderAt')::timestamptz>now() OR coalesce(task->>'ownerUserId','') !~ '^[a-f0-9-]{36}$' THEN CONTINUE; END IF;
   owner_id=(task->>'ownerUserId')::uuid;
   SELECT u.email INTO address FROM auth.users u JOIN public.organization_members m ON m.user_id=u.id AND m.organization_id=workspace.organization_id WHERE u.id=owner_id LIMIT 1;
   IF coalesce(address,'')='' THEN CONTINUE; END IF;
   INSERT INTO public.stark_notification_outbox(organization_id,event_key,kind,task_id,recipient,payload)
   VALUES(workspace.organization_id,'task:'||(task->>'id')||':'||(task->>'reminderAt'),'TASK_REMINDER',task->>'id',lower(address),jsonb_build_object('title',task->>'title','dueAt',task->>'dueAt','reminderAt',task->>'reminderAt','notes',task->>'notes','ownerUserId',owner_id))
   ON CONFLICT DO NOTHING;
  END LOOP;
 END LOOP;
 FOR item IN SELECT * FROM public.stark_notification_outbox q WHERE (p_organization_id IS NULL OR q.organization_id=p_organization_id)
  AND ((q.state IN ('QUEUED','RETRY') AND q.next_attempt_at<=now()) OR (q.state='SENDING' AND q.lease_until<now()))
  ORDER BY q.created_at LIMIT greatest(1,least(p_limit,50)) FOR UPDATE SKIP LOCKED LOOP
  SELECT document INTO doc FROM public.stark_unified_workspaces WHERE organization_id=item.organization_id;
  IF item.first_attempt_at<now()-interval '23 hours' THEN
   UPDATE public.stark_notification_outbox SET state='UNKNOWN',last_error='Delivery unconfirmed beyond provider idempotency window; review before any manual resend.' WHERE id=item.id;CONTINUE;
  END IF;
  IF item.kind='PRICE_CHANGE' THEN
   SELECT value INTO account FROM jsonb_array_elements(doc#>'{enterprise,accounts}') a WHERE a->>'id'=item.account_id;
   IF account IS NULL OR account->>'status'<>'ACTIVE' OR account#>'{priceNotifications,enabled}'='false'::jsonb OR NOT EXISTS(SELECT 1 FROM public.stark_price_recipients(account) recipient WHERE recipient=item.recipient)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(item.payload->'changes') change WHERE
      upper(coalesce(change->>'currency',item.payload->>'currency'))<>upper(coalesce(account->>'currency','USD')) OR
      (jsonb_typeof(account#>'{priceNotifications,brands}')='array' AND jsonb_array_length(account#>'{priceNotifications,brands}')>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(account#>'{priceNotifications,brands}') brand WHERE lower(brand)=lower(change->>'brand')))) THEN
    UPDATE public.stark_notification_outbox SET state='SKIPPED',last_error='CRM recipient or account delivery settings changed.' WHERE id=item.id;CONTINUE;
   END IF;
  ELSE
   SELECT value INTO task FROM jsonb_array_elements(coalesce(doc->'tasks','[]')) t WHERE t->>'id'=item.task_id;
   IF task IS NULL OR task->>'status'='DONE' OR task->>'reminderAt' IS DISTINCT FROM item.payload->>'reminderAt' OR NOT EXISTS(SELECT 1 FROM auth.users u JOIN public.organization_members m ON m.user_id=u.id AND m.organization_id=item.organization_id WHERE u.id::text=task->>'ownerUserId' AND lower(u.email)=item.recipient) THEN
    UPDATE public.stark_notification_outbox SET state='SKIPPED',last_error='Task completed, rescheduled, or owner access changed.' WHERE id=item.id;CONTINUE;
   END IF;
  END IF;
  UPDATE public.stark_notification_outbox SET state='SENDING',attempts=attempts+1,claim_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',first_attempt_at=coalesce(first_attempt_at,now()) WHERE id=item.id RETURNING * INTO item;
  RETURN NEXT item;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.stark_claim_notifications(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stark_claim_notifications(uuid,integer) TO service_role;
COMMIT;
