-- Index for check-overdue cron: find invoices where due_date < today and status not in ('paid','cancelled')
CREATE INDEX IF NOT EXISTS idx_invoices_due_date_status
  ON public.invoices (due_date, status)
  WHERE status NOT IN ('paid', 'cancelled');
