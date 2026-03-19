-- Allow process-sequences edge function to claim steps safely.
-- Adds 'processing' as a valid sequence_steps.status value.

alter table public.sequence_steps
  drop constraint if exists sequence_steps_status_check;

alter table public.sequence_steps
  add constraint sequence_steps_status_check
  check (
    status in (
      'pending',
      'processing',
      'sent',
      'opened',
      'clicked',
      'replied',
      'cancelled'
    )
  );

