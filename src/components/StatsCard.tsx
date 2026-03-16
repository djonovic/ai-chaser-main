import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { StatsCardData } from '@/types';

const variantBg: Record<string, string> = {
  destructive: 'bg-destructive/10',
  success: 'bg-success/10',
  info: 'bg-primary/10',
  warning: 'bg-warning/10',
};
const variantText: Record<string, string> = {
  destructive: 'text-destructive',
  success: 'text-success',
  info: 'text-primary',
  warning: 'text-warning',
};

export function StatsCard({ label, value, trend, icon: Icon, variant }: StatsCardData) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {trend !== undefined && (
              <div className={cn('flex items-center gap-1 text-xs font-medium', trend >= 0 ? 'text-success' : 'text-destructive')}>
                {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend)}% vs last month
              </div>
            )}
          </div>
          <div className={cn('rounded-xl p-3', variantBg[variant])}>
            <Icon className={cn('h-5 w-5', variantText[variant])} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
