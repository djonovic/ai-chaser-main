import { Badge } from '@/components/ui/badge';
import type { SequenceStatus } from '@/types';
import { cn } from '@/lib/utils';

const config: Record<SequenceStatus, { label: string; className: string }> = {
  active: { label: 'AI Active', className: 'bg-primary/15 text-primary border-primary/30' },
  idle: { label: 'Idle', className: 'bg-muted text-muted-foreground border-border' },
  paused: { label: 'Paused', className: 'bg-warning/15 text-warning border-warning/30' },
  completed: { label: 'Completed', className: 'bg-success/15 text-success border-success/30' },
};

export function AIStatusBadge({ status }: { status: SequenceStatus }) {
  const c = config[status];
  return (
    <Badge variant="outline" className={cn('font-medium text-xs', c.className)}>
      {c.label}
    </Badge>
  );
}
