-- Enable required extensions (run once in Supabase Dashboard → SQL Editor)
-- These are usually already available on Supabase, just need to be enabled.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Schedule: Process pending chase emails every 15 minutes
-- NOTE: Replace YOUR_PROJECT_REF with your actual Supabase project reference
-- NOTE: Replace YOUR_SERVICE_ROLE_KEY with your actual service role key
select cron.schedule(
  'process-sequences-every-15-min',
  '*/15 * * * *',
  $$
  select extensions.http_post(
    'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-sequences',
    '{}'::jsonb,
    'application/json',
    ARRAY[
      extensions.http_header('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY')
    ]
  );
  $$
);

-- Schedule: Check and mark overdue invoices daily at 6:00 AM UTC
select cron.schedule(
  'check-overdue-daily',
  '0 6 * * *',
  $$
  select extensions.http_post(
    'https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-overdue',
    '{}'::jsonb,
    'application/json',
    ARRAY[
      extensions.http_header('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY')
    ]
  );
  $$
);
