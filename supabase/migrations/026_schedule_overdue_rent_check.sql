-- Migration 026: Schedule daily overdue rent checks via pg_cron
-- Runs at 9 AM UTC every day and calls the check-overdue-rent Edge Function.
-- NOTE: pg_cron must be enabled in your Supabase project (Database → Extensions).
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.schedule(
  'check-overdue-rent-daily',
  '0 9 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/check-overdue-rent',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
