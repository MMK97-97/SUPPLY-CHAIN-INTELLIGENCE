-- Shared business settings are an owner/admin operation. This trigger also
-- covers clients that save the complete workspace through the existing RPC.
BEGIN;

CREATE OR REPLACE FUNCTION public.stark_valid_business_policy(p jsonb, partial boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE field text; val jsonb; lo integer; hi integer; qty numeric;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF NOT partial AND (SELECT count(*) FROM jsonb_object_keys(p)) <> 8 THEN RETURN false; END IF;
 FOR field,val IN SELECT key,value FROM jsonb_each(p) LOOP
  CASE field
   WHEN 'horizon' THEN lo:=1; hi:=365;
   WHEN 'orderAlertDays' THEN lo:=0; hi:=90;
   WHEN 'shipLeadDays' THEN lo:=0; hi:=90;
   WHEN 'safetyFloor' THEN lo:=0; hi:=1000000;
   WHEN 'returnsWindowDays' THEN lo:=0; hi:=365;
   WHEN 'shipCalendar' THEN
     IF val NOT IN ('"calendar"'::jsonb,'"weekdays"'::jsonb) THEN RETURN false; END IF;
     CONTINUE;
   WHEN 'includeDraftDemand' THEN
     IF val NOT IN ('"yes"'::jsonb,'"no"'::jsonb) THEN RETURN false; END IF;
     CONTINUE;
   WHEN 'timeZone' THEN
     IF jsonb_typeof(val)<>'string' OR (val #>> '{}') NOT IN
       ('America/New_York','America/Toronto','America/Chicago','America/Denver','America/Los_Angeles',
        'Europe/London','Europe/Brussels','Asia/Dubai','Asia/Kolkata','Asia/Singapore','Asia/Tokyo','Australia/Sydney','UTC') THEN RETURN false; END IF;
     CONTINUE;
   ELSE RETURN false;
  END CASE;
  IF jsonb_typeof(val) <> 'number' THEN RETURN false; END IF;
  qty:=(val #>> '{}')::numeric;
  IF qty<>trunc(qty) OR qty<lo OR qty>hi THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.stark_guard_business_configuration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE profile jsonb:=NEW.document->'businessProfile'; prior jsonb; code text; policy jsonb;
BEGIN
 IF TG_OP='UPDATE' THEN prior:=OLD.document->'businessProfile';
 ELSE SELECT document->'businessProfile' INTO prior FROM public.stark_unified_workspaces WHERE organization_id=NEW.organization_id;
 END IF;
 IF profile IS NOT DISTINCT FROM prior THEN RETURN NEW; END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' AND NOT EXISTS (
   SELECT 1 FROM public.organization_members m
   WHERE m.organization_id=NEW.organization_id AND m.user_id=auth.uid() AND lower(m.role::text) IN ('owner','admin')
 ) THEN RAISE EXCEPTION 'business_settings_owner_or_admin_required' USING ERRCODE='42501'; END IF;
 IF profile IS NULL THEN RETURN NEW; END IF;
 IF jsonb_typeof(profile) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_business_settings' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(profile)) <> 7 OR profile->'version' IS DISTINCT FROM '1'::jsonb
   OR jsonb_typeof(profile->'name') IS DISTINCT FROM 'string' OR length(profile->>'name')>64
   OR jsonb_typeof(profile->'template') IS DISTINCT FROM 'string' OR profile->>'template' NOT IN ('custom','distributor','commerce','outsourced','industrial')
   OR jsonb_typeof(profile->'modules') IS DISTINCT FROM 'array' OR jsonb_typeof(profile->'services') IS DISTINCT FROM 'object'
   OR jsonb_typeof(profile->'regions') IS DISTINCT FROM 'object'
   OR NOT public.stark_valid_business_policy(profile->'policies',false)
 THEN RAISE EXCEPTION 'invalid_business_settings' USING ERRCODE='22023'; END IF;
 IF NOT (profile->'modules' ? 'data') OR EXISTS (
   SELECT 1 FROM jsonb_array_elements(profile->'modules') m
   WHERE jsonb_typeof(m)<>'string' OR (m #>> '{}') NOT IN ('itemMaster','planning','crm','orders','vendor','procurement','shipping','warehouse','tpl','transportation','analytics','data')
 ) OR jsonb_array_length(profile->'modules')<>(SELECT count(DISTINCT m) FROM jsonb_array_elements(profile->'modules') m)
   OR (SELECT count(*) FROM jsonb_object_keys(profile->'services'))<>2
   OR jsonb_typeof(profile#>'{services,returns}') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(profile#>'{services,invoices}') IS DISTINCT FROM 'boolean'
 THEN RAISE EXCEPTION 'invalid_business_settings' USING ERRCODE='22023'; END IF;
 FOR code,policy IN SELECT key,value FROM jsonb_each(profile->'regions') LOOP
  IF code NOT IN ('US','CA','EU') OR NOT public.stark_valid_business_policy(policy,true) THEN
   RAISE EXCEPTION 'invalid_business_settings' USING ERRCODE='22023';
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.stark_valid_business_policy(jsonb,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.stark_guard_business_configuration() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS stark_business_configuration_guard ON public.stark_unified_workspaces;
CREATE TRIGGER stark_business_configuration_guard BEFORE INSERT OR UPDATE OF document
ON public.stark_unified_workspaces FOR EACH ROW EXECUTE FUNCTION public.stark_guard_business_configuration();
COMMIT;
