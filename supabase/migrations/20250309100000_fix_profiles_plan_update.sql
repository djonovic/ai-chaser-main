-- Fix plan change: allow UPDATE on profiles and ensure plan_expires_at exists.
-- Run in Supabase Dashboard → SQL Editor if plan change doesn’t work.

-- 1) Ensure column exists (no-op if it already does)
alter table public.profiles
  add column if not exists plan_expires_at timestamptz;

-- 2) Allow users to update their own profile (required for plan change)
-- Drop first so this is safe to run multiple times
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
