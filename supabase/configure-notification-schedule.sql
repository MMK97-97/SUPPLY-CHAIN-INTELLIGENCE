-- Run after deploying workspace-notifications and applying the 20261021 migration.
-- First create TWO secrets in Supabase Vault (Dashboard > Integrations > Vault):
--   stark_notification_url: https://YOUR_PROJECT.supabase.co/functions/v1/workspace-notifications
--   stark_notification_cron_secret: same >=32-character value as STARK_NOTIFICATION_CRON_SECRET
-- Do not commit secret values to this file. Run this script as the database owner.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='stark_notification_url' AND decrypted_secret ~ '^https://[^/]+\.supabase\.co/functions/v1/workspace-notifications$')
 OR NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='stark_notification_cron_secret' AND length(decrypted_secret)>=32)
 THEN RAISE EXCEPTION 'Create the notification URL and matching cron secret in Supabase Vault first.'; END IF;
END $$;
SELECT cron.schedule('stark-workspace-notifications','* * * * *',
 $job$ SELECT net.http_post(
   url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='stark_notification_url' LIMIT 1),
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='stark_notification_cron_secret' LIMIT 1)),
   body:='{}'::jsonb,timeout_milliseconds:=60000
 ); $job$);
-- The job processes a bounded queue each minute, including task reminders while browsers are closed.
-- ACCEPTED means the provider accepted the email; it does not claim inbox delivery.
