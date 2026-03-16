import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, Clock, Target } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { formatCurrency } from '@/lib/utils';
import { format, subMonths, startOfMonth, isAfter, differenceInDays, parseISO } from 'date-fns';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
          {entry.name === 'recovered' ? '✅ Recovered' : entry.name === 'overdue' ? '⚠️ Overdue' : '📈 Success Rate'}:{' '}
          <span className="font-semibold">
            {entry.name === 'rate' ? `${entry.value}%` : formatCurrency(entry.value)}
          </span>
        </p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const { invoices, loading } = useInvoices();

  const { totalRecovered, avgDaysToPayment, successRate, monthlyData, successData } = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = subMonths(now, 6);

    const recent = invoices.filter(inv => {
      const created = parseISO(inv.created_at);
      return isAfter(created, sixMonthsAgo);
    });

    const paidInvoices = recent.filter(i => i.status === 'paid');
    const totalRecovered = paidInvoices.reduce((sum, i) => sum + Number(i.amount), 0);

    const avgDays = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, i) => {
          const days = Math.abs(differenceInDays(parseISO(i.due_date), parseISO(i.created_at)));
          return sum + days;
        }, 0) / paidInvoices.length
      : 0;

    const successRate = recent.length > 0
      ? Math.round((paidInvoices.length / recent.length) * 100)
      : 0;

    const months: { month: string; recovered: number; overdue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthLabel = format(monthStart, 'MMM');
      const monthStr = format(monthStart, 'yyyy-MM');

      const monthInvoices = invoices.filter(inv => {
        const created = format(parseISO(inv.created_at), 'yyyy-MM');
        return created === monthStr;
      });

      months.push({
        month: monthLabel,
        recovered: monthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0),
        overdue: monthInvoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0),
      });
    }

    const successData = months.map(m => {
      const monthInvoices = invoices.filter(inv => format(parseISO(inv.created_at), 'MMM') === m.month);
      const paid = monthInvoices.filter(i => i.status === 'paid').length;
      const total = monthInvoices.length;
      return { month: m.month, rate: total > 0 ? Math.round((paid / total) * 100) : 0 };
    });

    return { totalRecovered, avgDaysToPayment: avgDays, successRate, monthlyData: months, successData };
  }, [invoices]);

  const stats = [
    { label: 'Total Recovered (6mo)', value: formatCurrency(totalRecovered), icon: TrendingUp, color: 'text-success' },
    { label: 'Avg Days to Payment', value: avgDaysToPayment > 0 ? `${avgDaysToPayment.toFixed(1)} days` : '—', icon: Clock, color: 'text-warning' },
    { label: 'Overall Success Rate', value: `${successRate}%`, icon: Target, color: 'text-primary' },
  ];

  if (loading) {
    return (
      <div className="space-y-6 fade-in">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const hasData = invoices.length > 0;

  return (
    <div className="space-y-6 fade-in">
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`rounded-lg bg-muted p-2.5 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No invoice data yet. Create invoices to see reports.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Monthly Recovery vs Overdue</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis className="text-xs" tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
                  <Legend formatter={v => v === 'recovered' ? 'Recovered' : 'Overdue'} />
                  <Bar dataKey="recovered" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="overdue" fill="hsl(var(--chart-4))" radius={[6, 6, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Payment Success Rate Over Time</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={successData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis className="text-xs" domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={() => 'Success Rate'} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: 'hsl(var(--chart-1))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                    activeDot={{ r: 7, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
