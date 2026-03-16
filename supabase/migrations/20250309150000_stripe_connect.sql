-- =============================================================================
-- Stripe Connect: one-click OAuth connection (like QuickBooks)
-- Run in Supabase SQL Editor or: supabase db push
-- =============================================================================

create table if not exists public.stripe_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade unique,
  stripe_account_id text not null,
  stripe_publishable_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stripe_connections enable row level security;

drop policy if exists "Users can manage own stripe_connections" on public.stripe_connections;
create policy "Users can manage own stripe_connections" on public.stripe_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create unique index if not exists idx_stripe_connections_account on public.stripe_connections (stripe_account_id);
