import { useMemo, useState } from 'react';

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );
}

export default function ARHealthScore() {
  const [totalOutstanding, setTotalOutstanding] = useState('');
  const [totalOverdue, setTotalOverdue] = useState('');
  const [avgDaysToPayment, setAvgDaysToPayment] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [collectedLast90, setCollectedLast90] = useState('');
  const [uncollectedLast90, setUncollectedLast90] = useState('');
  const [numberOfClients, setNumberOfClients] = useState('');
  const [industry, setIndustry] = useState('Freelance/Creative');

  const data = useMemo(() => {
    const outstanding = Number(totalOutstanding) || 0;
    const overdue = Number(totalOverdue) || 0;
    const invoiced90 = Number(collectedLast90) || 1;
    const unpaid90 = Number(uncollectedLast90) || 0;

    const overdueRatio = outstanding > 0 ? overdue / outstanding : 0;
    const overdueScore = overdueRatio < 0.05 ? 40 : overdueRatio < 0.15 ? 32 : overdueRatio < 0.25 ? 24 : overdueRatio < 0.4 ? 16 : overdueRatio < 0.6 ? 8 : 0;
    const dso = (outstanding / invoiced90) * 90;
    const dsoVsTerms = dso - parseInt(paymentTermsDays, 10);
    const dsoScore = dsoVsTerms <= 0 ? 30 : dsoVsTerms <= 7 ? 24 : dsoVsTerms <= 14 ? 18 : dsoVsTerms <= 21 ? 12 : dsoVsTerms <= 30 ? 6 : 0;
    const collectionRate = 1 - unpaid90 / invoiced90;
    const collectionScore = collectionRate >= 0.98 ? 30 : collectionRate >= 0.95 ? 24 : collectionRate >= 0.9 ? 18 : collectionRate >= 0.85 ? 12 : collectionRate >= 0.75 ? 6 : 0;
    const totalScore = overdueScore + dsoScore + collectionScore;
    const grade = totalScore >= 90 ? 'A' : totalScore >= 80 ? 'B' : totalScore >= 70 ? 'C' : totalScore >= 55 ? 'D' : 'F';
    const gradeClass: Record<string, string> = {
      A: 'bg-emerald-500',
      B: 'bg-sky-500',
      C: 'bg-amber-500',
      D: 'bg-orange-500',
      F: 'bg-red-500',
    };
    const weakest = [
      { name: 'overdue ratio', score: overdueScore, advice: 'Focus on reducing your overdue pile. Start with the oldest invoices first and use a consistent chasing sequence.' },
      { name: 'DSO', score: dsoScore, advice: 'Your clients are paying later than your terms. Consider shortening payment terms or adding early payment incentives.' },
      { name: 'collection rate', score: collectionScore, advice: 'Too many invoices are going uncollected. Automate follow-ups so no invoice falls through the cracks.' },
    ].sort((a, b) => a.score - b.score)[0];

    return { overdueRatio, overdueScore, dso, dsoScore, collectionRate, collectionScore, totalScore, grade, gradeClass, weakest };
  }, [totalOutstanding, totalOverdue, paymentTermsDays, collectedLast90, uncollectedLast90]);

  const copyScore = async () => {
    const text = `My AR Health Score: ${data.grade} (${data.totalScore}/100) — DSO ${data.dso.toFixed(0)} days | Collection rate ${(data.collectionRate * 100).toFixed(0)}% | via chaseai.app/tools/accounts-receivable-health-score`;
    await navigator.clipboard.writeText(text);
  };

  return (
    <div id="calculator" className="not-prose rounded-xl border border-border bg-muted/20 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Total amount currently outstanding ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={totalOutstanding} onChange={(e) => setTotalOutstanding(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Amount currently overdue ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={totalOverdue} onChange={(e) => setTotalOverdue(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Average days clients take to pay</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="e.g. 28" value={avgDaysToPayment} onChange={(e) => setAvgDaysToPayment(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Your payment terms (days)</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)}><option>7</option><option>14</option><option>30</option><option>45</option><option>60</option></select></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Total invoiced in last 90 days ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={collectedLast90} onChange={(e) => setCollectedLast90(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Amount still unpaid from last 90 days ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={uncollectedLast90} onChange={(e) => setUncollectedLast90(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Number of active clients</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={numberOfClients} onChange={(e) => setNumberOfClients(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Industry</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={industry} onChange={(e) => setIndustry(e.target.value)}><option>Freelance/Creative</option><option>Agency/Marketing</option><option>Consulting</option><option>Trades/Construction</option><option>SaaS/Tech</option><option>Other</option></select></label>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-background p-4">
        <div className="flex items-center gap-4">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white ${data.gradeClass[data.grade]}`}>{data.grade}</div>
          <div>
            <p className="text-sm text-muted-foreground">Accounts Receivable Health Score</p>
            <p className="text-xl font-bold">{data.totalScore}/100</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <p>Your DSO: <strong>{data.dso.toFixed(1)} days</strong> (target: {paymentTermsDays} days)</p>
          <p>{(data.overdueRatio * 100).toFixed(1)}% of outstanding is overdue</p>
          <p>{(data.collectionRate * 100).toFixed(1)}% of invoices collected within 90 days</p>
        </div>
        <div className="mt-4 space-y-2">
          <div><p className="text-xs text-muted-foreground">Overdue Ratio</p><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-amber-500" style={{ width: `${(data.overdueScore / 40) * 100}%` }} /></div></div>
          <div><p className="text-xs text-muted-foreground">DSO Performance</p><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-sky-500" style={{ width: `${(data.dsoScore / 30) * 100}%` }} /></div></div>
          <div><p className="text-xs text-muted-foreground">Collection Efficiency</p><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-emerald-500" style={{ width: `${(data.collectionScore / 30) * 100}%` }} /></div></div>
        </div>
        <p className="mt-4 text-sm"><strong>What to fix first:</strong> {data.weakest.advice}</p>
        <button type="button" onClick={copyScore} className="mt-3 rounded-lg border border-border px-4 py-2 text-sm font-semibold">Copy my score</button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Snapshot context: outstanding {fmtCurrency(Number(totalOutstanding) || 0)} · overdue {fmtCurrency(Number(totalOverdue) || 0)} · clients {numberOfClients || 0} · industry {industry}</p>
    </div>
  );
}
