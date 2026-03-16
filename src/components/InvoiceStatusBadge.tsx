import { Badge } from '@/components/ui/badge';
import type { InvoiceStatus } from '@/types';
import { cn } from '@/lib/utils';

const statusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-success/15 text-success border-success/30' },
  sent: { label: 'Sent', className: 'bg-warning/15 text-warning border-warning/30' },
  overdue: { label: 'Overdue', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground border-border' },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn('font-medium text-xs', config.className)}>
      {config.label}
    </Badge>
  );
}
