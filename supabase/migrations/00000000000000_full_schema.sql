-- =============================================================================
-- Full Supabase schema for ai-chaser (Lovable project)
-- Run once in Supabase Dashboard → SQL Editor (or via: supabase db push)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PROFILES (user plan, AI usage, Gemini key)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro')),
  ai_usage_count int not null default 0,
  ai_usage_reset_at timestamptz,
  gemini_api_key text,
  plan_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, plan) values (new.id, 'free') on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- RPC: increment AI usage (used by usePlan)
create or replace function public.increment_ai_usage(_user_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare new_count int;
begin
  if _user_id is null or _user_id != auth.uid() then raise exception 'Unauthorized'; end if;
  update public.profiles set ai_usage_count = coalesce(ai_usage_count, 0) + 1, updated_at = now() where id = _user_id
  returning ai_usage_count into new_count;
  if new_count is null then
    insert into public.profiles (id, plan, ai_usage_count, updated_at) values (_user_id, 'free', 1, now())
    returning ai_usage_count into new_count;
  end if;
  return coalesce(new_count, 0);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. SETTINGS (per-user: Resend, email from, etc.)
-- -----------------------------------------------------------------------------
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade unique,
  resend_api_key text,
  email_from text,
  email_from_name text,
  gemini_api_key text,
  stripe_api_key text,
  sms_enabled boolean not null default false,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "Users can view own settings" on public.settings;
create policy "Users can view own settings" on public.settings for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.settings;
create policy "Users can insert own settings" on public.settings for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.settings;
create policy "Users can update own settings" on public.settings for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. CLIENTS
-- -----------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  language text not null default 'en',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

drop policy if exists "Users can manage own clients" on public.clients;
create policy "Users can manage own clients" on public.clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. INVOICES
-- -----------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  invoice_number text not null,
  amount numeric not null,
  currency text not null default 'USD',
  due_date date not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'overdue', 'paid', 'cancelled')),
  pdf_url text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.invoices enable row level security;

drop policy if exists "Users can manage own invoices" on public.invoices;
create policy "Users can manage own invoices" on public.invoices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. SEQUENCES
-- -----------------------------------------------------------------------------
create table if not exists public.sequences (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tone text not null default 'friendly' check (tone in ('friendly', 'professional', 'firm', 'humorous')),
  status text not null default 'idle' check (status in ('idle', 'active', 'paused', 'completed')),
  current_step int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.sequences enable row level security;

drop policy if exists "Users can manage own sequences" on public.sequences;
create policy "Users can manage own sequences" on public.sequences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 6. SEQUENCE_STEPS
-- -----------------------------------------------------------------------------
create table if not exists public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.sequences (id) on delete cascade,
  step_number int not null,
  send_at timestamptz not null,
  subject text not null,
  body text not null,
  channel text not null default 'email' check (channel in ('email', 'sms')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'opened', 'clicked', 'replied')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.sequence_steps enable row level security;

-- Steps are accessed via sequence ownership; service role (edge function) needs full access
drop policy if exists "Users can view steps of own sequences" on public.sequence_steps;
create policy "Users can view steps of own sequences" on public.sequence_steps for select
  using (exists (select 1 from public.sequences s where s.id = sequence_steps.sequence_id and s.user_id = auth.uid()));

drop policy if exists "Users can insert steps for own sequences" on public.sequence_steps;
create policy "Users can insert steps for own sequences" on public.sequence_steps for insert
  with check (exists (select 1 from public.sequences s where s.id = sequence_steps.sequence_id and s.user_id = auth.uid()));

drop policy if exists "Users can update steps of own sequences" on public.sequence_steps;
create policy "Users can update steps of own sequences" on public.sequence_steps for update
  using (exists (select 1 from public.sequences s where s.id = sequence_steps.sequence_id and s.user_id = auth.uid()));

drop policy if exists "Users can delete steps of own sequences" on public.sequence_steps;
create policy "Users can delete steps of own sequences" on public.sequence_steps for delete
  using (exists (select 1 from public.sequences s where s.id = sequence_steps.sequence_id and s.user_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- 7. REALTIME (for live updates in the app)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'invoices') then
    alter publication supabase_realtime add table public.invoices;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'sequences') then
    alter publication supabase_realtime add table public.sequences;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'sequence_steps') then
    alter publication supabase_realtime add table public.sequence_steps;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. OPTIONAL: Backfill profiles for existing auth users (run once if needed)
-- -----------------------------------------------------------------------------
-- insert into public.profiles (id, plan)
-- select id, 'free' from auth.users on conflict (id) do nothing;
