-- Run as database owner after deploying mk-copilot and applying 20261023_mk_copilot.sql.
-- Create these two secrets in Supabase Vault first. Do not put their values in Git:
--   stark_copilot_url = https://YOUR_PROJECT.supabase.co/functions/v1/mk-copilot
--   stark_copilot_cron_secret = the same >=32-character STARK_COPILOT_CRON_SECRET
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='stark_copilot_url' AND decrypted_secret ~ '^https://[^/]+\.supabase\.co/functions/v1/mk-copilot$')
 OR NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='stark_copilot_cron_secret' AND length(decrypted_secret)>=32)
 THEN RAISE EXCEPTION 'Create the Co-Pilot endpoint URL and matching cron secret in Supabase Vault first.'; END IF;
END $$;
SELECT cron.schedule('stark-mk-copilot-monitor','* * * * *',
 $job$ SELECT net.http_post(
  url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='stark_copilot_url' LIMIT 1),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='stark_copilot_cron_secret' LIMIT 1)),
  body:='{"action":"scan"}'::jsonb,timeout_milliseconds:=60000
 ); $job$);
-- Up to 25 due organizations per invocation, with a five-minute claim per organization.
-- Larger installations must size their monitor frequency/batch throughput accordingly.
-- Results are durable in stark_copilot_alerts while the browser is closed.
-- Existing workspace-notifications scheduling still handles follow-up reminder emails.
