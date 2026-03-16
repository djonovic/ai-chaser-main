import { Skeleton } from '@/components/ui/skeleton';

export function StatsCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 7 }: { cols?: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
      </div>
      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-0">
          {Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}
