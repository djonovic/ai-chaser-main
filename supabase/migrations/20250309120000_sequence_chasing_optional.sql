-- =============================================================================
-- Optional: Run in Supabase SQL Editor if you need quota reset or helpers.
-- Existing schema (sequences, sequence_steps, profiles.ai_usage_count) is unchanged.
-- =============================================================================

-- Optional: RPC to reset AI usage for the current user (e.g. for testing).
-- Only run if you need this; PlanContext already resets by ai_usage_reset_at.
create or replace function public.reset_ai_usage_current_user()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  update public.profiles
  set ai_usage_count = 0,
      ai_usage_reset_at = (date_trunc('month', now()) + interval '1 month')::timestamptz,
      updated_at = now()
  where id = auth.uid();
end;
$$;

-- Grant execute to authenticated users (optional).
grant execute on function public.reset_ai_usage_current_user() to authenticated;

-- Realtime is already enabled in 00000000000000_full_schema.sql for sequences and sequence_steps.
-- No new columns or indexes are required for the refactored flow.
