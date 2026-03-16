-- =============================================================================
-- Integrations: Stripe (paid_via, keys), sequence_steps cancelled, Accounting + Gmail connections
-- Run in Supabase SQL Editor or: supabase db push
-- =============================================================================

-- 1. Invoices: track how invoice was marked paid (for toasts / reporting)
alter table public.invoices
  add column if not exists paid_via text check (paid_via is null or paid_via in ('manual', 'stripe', 'quickbooks', 'xero'));

-- 2. Settings: Stripe Publishable Key (Secret Key already exists as stripe_api_key)
alter table public.settings
  add column if not exists stripe_publishable_key text;

-- 3. Sequence steps: allow 'cancelled' when sequence is completed early (e.g. payment received)
alter table public.sequence_steps
  drop constraint if exists sequence_steps_status_check;
alter table public.sequence_steps
  add constraint sequence_steps_status_check
  check (status in ('pending', 'sent', 'opened', 'clicked', 'replied', 'cancelled'));

-- 4. Accounting connections (QuickBooks, Xero) – store OAuth tokens per user
create table if not exists public.accounting_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('quickbooks', 'xero')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  realm_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.accounting_connections enable row level security;

drop policy if exists "Users can manage own accounting_connections" on public.accounting_connections;
create policy "Users can manage own accounting_connections" on public.accounting_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. Gmail connections – OAuth tokens for reply detection
create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade unique,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gmail_connections enable row level security;

drop policy if exists "Users can manage own gmail_connections" on public.gmail_connections;
create policy "Users can manage own gmail_connections" on public.gmail_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. Sequences: optional paused_reason for "Client replied – sequence paused"
alter table public.sequences
  add column if not exists paused_reason text;

-- 7. Index for webhook/sync lookups by invoice_number
create index if not exists idx_invoices_invoice_number on public.invoices (user_id, invoice_number);

-- 8. Service role needs to update invoices/sequences/steps from webhooks (RLS allows by user_id; edge functions use service_role which bypasses RLS)
-- No extra grants needed; service_role has full access.
