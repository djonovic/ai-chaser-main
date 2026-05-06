import { useMemo, useState } from 'react';

type InvoiceRow = {
  id: string;
  clientName: string;
  amount: string;
  invoiceDate: string;
  dueDate: string;
  avgDaysToPayHistory: string;
};

const DAY_COUNT = 90;

function dateAdd(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function money(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

export default function CashFlowGapVisualizer() {
  const [monthlyExpenses, setMonthlyExpenses] = useState('');
  const [safetyBuffer, setSafetyBuffer] = useState('');
  const [currentCashBalance, setCurrentCashBalance] = useState('');
  const [invoices, setInvoices] = useState<InvoiceRow[]>([
    { id: '1', clientName: '', amount: '', invoiceDate: '', dueDate: '', avgDaysToPayHistory: '0' },
  ]);

  const timeline = useMemo(() => {
    const start = new Date();
    const monthly = Number(monthlyExpenses) || 0;
    const buffer = Number(safetyBuffer) || 0;
    const currentCash = Number(currentCashBalance) || 0;
    const dailyExpense = monthly / 30;

    const parsed = invoices
      .map((inv) => {
        const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
        if (!dueDate) return null;
        const amount = Number(inv.amount) || 0;
        const delay = Number(inv.avgDaysToPayHistory) || 0;
        return {
          clientName: inv.clientName || 'Client',
          amount,
          expectedDate: dueDate,
          realisticDate: dateAdd(dueDate, delay),
          delay,
        };
      })
      .filter(Boolean) as { clientName: string; amount: number; expectedDate: Date; realisticDate: Date; delay: number }[];

    const expectedSeries: number[] = [];
    const realisticSeries: number[] = [];

    for (let day = 0; day <= DAY_COUNT; day += 1) {
      const mark = dateAdd(start, day);
      const expectedIncome = parsed.filter((p) => p.expectedDate <= mark).reduce((sum, p) => sum + p.amount, 0);
      const realisticIncome = parsed.filter((p) => p.realisticDate <= mark).reduce((sum, p) => sum + p.amount, 0);
      expectedSeries.push(currentCash + expectedIncome - dailyExpense * day);
      realisticSeries.push(currentCash + realisticIncome - dailyExpense * day);
    }

    let maxGap = 0;
    let maxGapDay = 0;
    let stressDays = 0;
    for (let i = 0; i < expectedSeries.length; i += 1) {
      const gap = expectedSeries[i] - realisticSeries[i];
      if (gap > maxGap) {
        maxGap = gap;
        maxGapDay = i;
      }
      if (realisticSeries[i] < buffer) stressDays += 1;
    }

    const topDelays = [...parsed].sort((a, b) => b.delay - a.delay).slice(0, 2);
    return { expectedSeries, realisticSeries, maxGap, maxGapDay, stressDays, buffer, start, topDelays };
  }, [invoices, monthlyExpenses, safetyBuffer, currentCashBalance]);

  const minVal = Math.min(...timeline.realisticSeries, ...timeline.expectedSeries, timeline.buffer);
  const maxVal = Math.max(...timeline.realisticSeries, ...timeline.expectedSeries, timeline.buffer, 1);
  const range = maxVal - minVal || 1;
  const toX = (i: number) => (i / DAY_COUNT) * 100;
  const toY = (v: number) => 100 - ((v - minVal) / range) * 100;
  const expectedPath = timeline.expectedSeries.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ');
  const realisticPath = timeline.realisticSeries.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ');

  return (
    <div id="calculator" className="not-prose rounded-xl border border-border bg-muted/20 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Your monthly fixed expenses ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Desired minimum cash buffer ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={safetyBuffer} onChange={(e) => setSafetyBuffer(e.target.value)} /></label>
        <label className="text-sm md:col-span-2"><span className="mb-1 block text-muted-foreground">Current cash balance ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={currentCashBalance} onChange={(e) => setCurrentCashBalance(e.target.value)} /></label>
      </div>

      <div className="mt-4 space-y-3">
        {invoices.map((inv, idx) => (
          <div key={inv.id} className="grid gap-2 rounded-lg border border-border bg-background p-3 md:grid-cols-5">
            <input className="rounded border border-border px-2 py-1 text-sm" placeholder="Client name" value={inv.clientName} onChange={(e) => setInvoices((rows) => rows.map((r) => r.id === inv.id ? { ...r, clientName: e.target.value } : r))} />
            <input className="rounded border border-border px-2 py-1 text-sm" type="number" placeholder="Amount" value={inv.amount} onChange={(e) => setInvoices((rows) => rows.map((r) => r.id === inv.id ? { ...r, amount: e.target.value } : r))} />
            <input className="rounded border border-border px-2 py-1 text-sm" type="date" value={inv.invoiceDate} onChange={(e) => setInvoices((rows) => rows.map((r) => r.id === inv.id ? { ...r, invoiceDate: e.target.value } : r))} />
            <input className="rounded border border-border px-2 py-1 text-sm" type="date" value={inv.dueDate} onChange={(e) => setInvoices((rows) => rows.map((r) => r.id === inv.id ? { ...r, dueDate: e.target.value } : r))} />
            <input className="rounded border border-border px-2 py-1 text-sm" type="number" placeholder="Avg days late" value={inv.avgDaysToPayHistory} onChange={(e) => setInvoices((rows) => rows.map((r) => r.id === inv.id ? { ...r, avgDaysToPayHistory: e.target.value } : r))} />
            <div className="md:col-span-5 text-right">
              {invoices.length > 1 && <button type="button" className="text-xs text-red-600" onClick={() => setInvoices((rows) => rows.filter((r) => r.id !== inv.id))}>Remove</button>}
            </div>
          </div>
        ))}
        {invoices.length < 8 && <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm" onClick={() => setInvoices((rows) => [...rows, { id: String(Date.now()), clientName: '', amount: '', invoiceDate: '', dueDate: '', avgDaysToPayHistory: '0' }])}>Add invoice</button>}
      </div>

      <div className="mt-5 rounded-xl border border-border bg-background p-4">
        <svg viewBox="0 0 100 100" className="h-56 w-full rounded bg-white">
          <line x1="0" y1={toY(timeline.buffer)} x2="100" y2={toY(timeline.buffer)} stroke="#f59e0b" strokeWidth="0.7" />
          <path d={expectedPath} fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 2" />
          <path d={realisticPath} fill="none" stroke="#ef4444" strokeWidth="1" />
        </svg>
        <p className="mt-2 text-xs text-muted-foreground">Blue dashed: expected cash flow · Red: realistic cash flow · Amber line: safety buffer</p>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-background p-3 text-sm">
        <p className="font-semibold">📊 YOUR CASH FLOW PICTURE</p>
        <p>Biggest gap period: day {Math.max(0, timeline.maxGapDay - 3)} to day {timeline.maxGapDay + 3}</p>
        <p>Maximum gap: <strong>{money(timeline.maxGap)}</strong></p>
        <p>Stress risk days: <strong>{timeline.stressDays}</strong> days below your {money(timeline.buffer)} buffer</p>
        {timeline.topDelays.length > 0 && (
          <div className="mt-2">
            <p className="font-medium">Invoices causing the most delay:</p>
            {timeline.topDelays.map((d) => (
              <p key={`${d.clientName}-${d.delay}`} className="text-sm">{d.clientName} — {money(d.amount)} — {d.delay} days late on average</p>
            ))}
          </div>
        )}
        {timeline.stressDays > 0 && <p className="mt-2 text-red-600">⚠️ Your cash flow goes below your safety buffer in this forecast period.</p>}
      </div>
      <p className="mt-3 text-sm">ChaseAI closes this gap by automating follow-ups before invoices become overdue — not after.</p>
    </div>
  );
}
