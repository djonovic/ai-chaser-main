-- Store Resend email id so we can map webhook events (e.g. email.opened) back to sequence_steps
alter table public.sequence_steps
  add column if not exists resend_email_id text;

comment on column public.sequence_steps.resend_email_id is 'Resend API email id; used by resend-webhook to mark step as opened when recipient opens the email.';
