import { useMemo, useState } from 'react';

const BENCHMARKS: Record<string, number> = {
  'Freelance/Creative': 28,
  'Agency/Marketing': 38,
  Consulting: 32,
  'Construction/Trades': 47,
  'SaaS/Tech': 42,
  'Professional Services': 35,
  'Retail/eCommerce': 22,
  Healthcare: 55,
};

function money(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number.isFinite(v) ? v : 0,
  );
}

export default function DSOCalculator() {
  const [accountsReceivable, setAccountsReceivable] = useState('');
  const [totalCreditSales, setTotalCreditSales] = useState('');
  const [periodDays, setPeriodDays] = useState('90');
  const [industry, setIndustry] = useState('Freelance/Creative');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');

  const output = useMemo(() => {
    const ar = Number(accountsReceivable) || 0;
    const sales = Number(totalCreditSales) || 1;
    const days = parseInt(periodDays, 10);
    const terms = parseInt(paymentTerms.replace('Net ', ''), 10);
    const dso = (ar / sales) * days;
    const bpdso = terms * 0.9;
    const delinquentDSO = dso - bpdso;
    const benchmark = BENCHMARKS[industry];
    const dsoVsBenchmark = dso - benchmark;
    const dsoVsTerms = dso - terms;
    const dailyRevenue = sales / days;
    const cashTiedUp = dso * dailyRevenue;
    const excessCashTiedUp = Math.max(0, dsoVsTerms) * dailyRevenue;
    return { dso, bpdso, delinquentDSO, benchmark, dsoVsBenchmark, dsoVsTerms, dailyRevenue, cashTiedUp, excessCashTiedUp, terms };
  }, [accountsReceivable, totalCreditSales, periodDays, industry, paymentTerms]);

  return (
    <div id="calculator" className="not-prose rounded-xl border border-border bg-muted/20 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Total accounts receivable balance ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={accountsReceivable} onChange={(e) => setAccountsReceivable(e.target.value)} /><span className="mt-1 block text-xs text-muted-foreground">Sum of all outstanding invoices</span></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Total credit sales in the period ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={totalCreditSales} onChange={(e) => setTotalCreditSales(e.target.value)} /><span className="mt-1 block text-xs text-muted-foreground">Total invoiced (not cash) revenue</span></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Measurement period</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={periodDays} onChange={(e) => setPeriodDays(e.target.value)}><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option><option value="365">365 days</option></select></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Industry</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={industry} onChange={(e) => setIndustry(e.target.value)}>{Object.entries(BENCHMARKS).map(([k, v]) => <option key={k} value={k}>{`${k} (benchmark: ${v} days)`}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Payment terms</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}><option>Net 7</option><option>Net 14</option><option>Net 30</option><option>Net 45</option><option>Net 60</option></select></label>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-background p-4">
        <p className="text-xs text-muted-foreground">YOUR DSO</p>
        <p className="text-3xl font-bold">{output.dso.toFixed(1)} days</p>
        <div className="mt-4 space-y-3 text-sm">
          <div><div className="mb-1 flex justify-between"><span>Your DSO</span><span>{output.dso.toFixed(1)} days</span></div><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, (output.dso / 90) * 100)}%` }} /></div></div>
          <div><div className="mb-1 flex justify-between"><span>Industry benchmark</span><span>{output.benchmark} days</span></div><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-emerald-500" style={{ width: `${Math.min(100, (output.benchmark / 90) * 100)}%` }} /></div></div>
          <div><div className="mb-1 flex justify-between"><span>Your payment terms</span><span>{output.terms} days</span></div><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-amber-500" style={{ width: `${Math.min(100, (output.terms / 90) * 100)}%` }} /></div></div>
        </div>
        <p className="mt-4 text-sm">{output.dso > output.benchmark ? `⚠️ Your DSO is ${(output.dsoVsBenchmark).toFixed(1)} days above your industry benchmark` : '✅ You are collecting faster than your industry average'}</p>
        <div className="mt-4 rounded-lg border border-border p-3 text-sm">
          <p className="font-semibold">💰 CASH FLOW IMPACT</p>
          <p>Cash currently tied in AR: <strong>{money(output.cashTiedUp)}</strong></p>
          <p>Excess cash vs your terms: <strong>{money(output.excessCashTiedUp)}</strong> ({Math.max(0, output.dsoVsTerms).toFixed(1)} extra days)</p>
          <p>Daily revenue value: <strong>{money(output.dailyRevenue)}/day</strong></p>
          <p className="mt-2">📈 If you reduced DSO by 7 days, you would free up: <strong>{money(Math.round(7 * output.dailyRevenue))}</strong></p>
          <p className="mt-2 text-xs text-muted-foreground">BPDSO estimate: {output.bpdso.toFixed(1)} days · Delinquent DSO: {output.delinquentDSO.toFixed(1)} days</p>
        </div>
      </div>
    </div>
  );
}
