import { TableHead } from '@/components/ui/table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

interface SortableTableHeadProps {
  children: React.ReactNode;
  sortKey: string;
  currentSort: string | null;
  currentDirection: SortDirection;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTableHead({ children, sortKey, currentSort, currentDirection, onSort, className }: SortableTableHeadProps) {
  const isActive = currentSort === sortKey;

  return (
    <TableHead
      className={cn('cursor-pointer select-none hover:text-foreground transition-colors', className)}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1.5">
        {children}
        {isActive && currentDirection === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : isActive && currentDirection === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </div>
    </TableHead>
  );
}
