import { useState, useMemo, useCallback } from 'react';
import type { SortDirection } from '@/components/SortableTableHead';

export function useSortable<T>(data: T[], defaultKey: string | null = null, defaultDir: SortDirection = null) {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDir);

  const onSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
      if (sortDirection === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }, [sortKey, sortDirection]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDirection) return data;
    return [...data].sort((a, b) => {
      const aVal = getNestedValue(a, sortKey);
      const bVal = getNestedValue(b, sortKey);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDirection]);

  return { sorted, sortKey, sortDirection, onSort };
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
