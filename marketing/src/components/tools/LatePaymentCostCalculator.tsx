import { useMemo, useState } from 'react';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export default function LatePaymentCostCalculator() {
  const [averageInvoiceValue, setAverageInvoiceValue] = useState('');
  const [numberOfOverdueInvoices, setNumberOfOverdueInvoices] = useState('');
  const [averageDaysOverdue, setAverageDaysOverdue] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [hoursPerChase, setHoursPerChase] = useState('1.5');
  const [annualLateInvoices, setAnnualLateInvoices] = useState('');
  const [showResults, setShowResults] = useState(false);

  const results = useMemo(() => {
    const avgInvoice = Number(averageInvoiceValue) || 0;
    const overdueCount = Number(numberOfOverdueInvoices) || 0;
    const avgDays = Number(averageDaysOverdue) || 0;
    const rate = Number(hourlyRate) || 0;
    const chaseHours = Number(hoursPerChase) || 0;
    const annualLate = Number(annualLateInvoices) || 0;

    const totalOverdue = avgInvoice * overdueCount;
    const opportunityCostRate = 0.08;
    const cashFlowGapCost = totalOverdue * (opportunityCostRate / 365) * avgDays;
    const totalHoursChasing = chaseHours * overdueCount;
    const timeValueLost = totalHoursChasing * rate;
    const annualTimeCost = annualLate * chaseHours * rate;
    const annualOpportunityCost = avgInvoice * annualLate * (opportunityCostRate / 365) * avgDays;
    const annualTotalCost = annualTimeCost + annualOpportunityCost;
    const costPerLateInvoice = overdueCount > 0 ? (timeValueLost + cashFlowGapCost) / overdueCount : 0;

    return {
      totalOverdue,
      cashFlowGapCost,
      timeValueLost,
      annualTotalCost,
      annualHours: annualLate * chaseHours,
      costPerLateInvoice,
      monthlyCost: Math.round(annualTotalCost / 12),
      currentTotalCost: cashFlowGapCost + timeValueLost,
      timeShare:
        timeValueLost + cashFlowGapCost > 0 ? (timeValueLost / (timeValueLost + cashFlowGapCost)) * 100 : 0,
    };
  }, [averageInvoiceValue, numberOfOverdueInvoices, averageDaysOverdue, hourlyRate, hoursPerChase, annualLateInvoices]);

  return (
    <div id="calculator" className="not-prose rounded-xl border border-border bg-muted/20 p-5 md:p-6">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Average invoice value ($)</span>
          <input className="w-full rounded-lg border border-border bg-background px-3 py-2" type="number" placeholder="e.g. 2500" value={averageInvoiceValue} onChange={(e) => setAverageInvoiceValue(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Number of invoices currently overdue</span>
          <input className="w-full rounded-lg border border-border bg-background px-3 py-2" type="number" placeholder="e.g. 4" value={numberOfOverdueInvoices} onChange={(e) => setNumberOfOverdueInvoices(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Average days overdue</span>
          <input className="w-full rounded-lg border border-border bg-background px-3 py-2" type="number" placeholder="e.g. 22" value={averageDaysOverdue} onChange={(e) => setAverageDaysOverdue(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Your hourly rate ($)</span>
          <input className="w-full rounded-lg border border-border bg-background px-3 py-2" type="number" placeholder="e.g. 75" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Hours spent chasing per invoice</span>
          <input className="w-full rounded-lg border border-border bg-background px-3 py-2" type="number" step="0.1" placeholder="e.g. 1.5" value={hoursPerChase} onChange={(e) => setHoursPerChase(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Late invoices per year (estimate)</span>
          <input className="w-full rounded-lg border border-border bg-background px-3 py-2" type="number" placeholder="e.g. 18" value={annualLateInvoices} onChange={(e) => setAnnualLateInvoices(e.target.value)} />
        </label>
      </div>
      <button type="button" onClick={() => setShowResults(true)} className="mt-4 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
        Calculate cost
      </button>

      {showResults && (
        <div className="mt-6 rounded-xl border border-amber-300/60 bg-amber-50/60 p-4">
          <p className="text-sm font-semibold">📊 YOUR LATE PAYMENT SNAPSHOT</p>
          <div className="mt-3 space-y-1 text-sm">
            <p>Currently overdue: <strong>{formatCurrency(results.totalOverdue)}</strong></p>
            <p>Cash flow gap cost (opportunity): <strong>{formatCurrency(results.cashFlowGapCost)}</strong></p>
            <p>Time value lost chasing: <strong>{formatCurrency(results.timeValueLost)}</strong></p>
            <p className="pt-1 border-t border-amber-200 mt-2">Real cost of current late invoices: <strong>{formatCurrency(results.currentTotalCost)}</strong></p>
          </div>

          <div className="mt-4 rounded-lg border border-emerald-300/50 bg-emerald-50 p-3 text-sm">
            <p className="font-semibold">📅 ANNUAL PROJECTION</p>
            <p>Estimated annual cost of late payments: <strong>{formatCurrency(Math.round(results.annualTotalCost))}</strong></p>
            <p>Hours spent chasing per year: <strong>{results.annualHours.toFixed(1)}h</strong></p>
            <p>True cost per late invoice: <strong>{formatCurrency(results.costPerLateInvoice)}</strong></p>
            <p className="mt-2">💡 At this rate, late payments cost you approximately <strong>{formatCurrency(results.monthlyCost)}/month</strong></p>
          </div>

          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">Cost split: time cost vs opportunity cost</p>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-3 bg-emerald-500" style={{ width: `${results.timeShare}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Time cost</span>
              <span>Opportunity cost</span>
            </div>
          </div>

          <div className="mt-4 text-sm">
            <p>ChaseAI automates every follow-up so you recover this time and close the cash gap faster.</p>
            <a href="https://app.chaseai.app" className="mt-2 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Start free trial
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
