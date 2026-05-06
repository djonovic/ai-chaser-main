import { useMemo, useState } from 'react';

function usd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default function FreelanceRateCalculator() {
  const [targetMonthlyIncome, setTargetMonthlyIncome] = useState('');
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState('20');
  const [hoursPerDay, setHoursPerDay] = useState('6');
  const [monthlyExpenses, setMonthlyExpenses] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [percentClientsLatePayers, setPercentClientsLatePayers] = useState('');
  const [avgDaysLate, setAvgDaysLate] = useState('');
  const [percentBadDebt, setPercentBadDebt] = useState('');
  const [hoursPerMonthChasing, setHoursPerMonthChasing] = useState('');

  const out = useMemo(() => {
    const income = Number(targetMonthlyIncome) || 0;
    const days = Number(workingDaysPerMonth) || 1;
    const hpd = Number(hoursPerDay) || 1;
    const expenses = Number(monthlyExpenses) || 0;
    const tax = Number(taxRate) || 0;
    const latePayers = Number(percentClientsLatePayers) || 0;
    const avgLate = Number(avgDaysLate) || 0;
    const badDebt = Number(percentBadDebt) || 0;
    const chaseHours = Number(hoursPerMonthChasing) || 0;

    const preTaxIncome = income / (1 - tax / 100 || 1);
    const grossRevenueNeeded = preTaxIncome + expenses;
    const badDebtAdjusted = grossRevenueNeeded / (1 - badDebt / 100 || 1);
    const monthlyRevenueAtRisk = badDebtAdjusted * (latePayers / 100);
    const latePaymentOpportunityCost = monthlyRevenueAtRisk * (0.08 / 365) * avgLate;
    const baselineHourlyRate = grossRevenueNeeded / (days * hpd);
    const chasingTimeCost = chaseHours * baselineHourlyRate;
    const totalAdjustedRevenue = badDebtAdjusted + latePaymentOpportunityCost + chasingTimeCost;
    const totalBillableHours = days * hpd;
    const hourlyRate = totalAdjustedRevenue / totalBillableHours;
    const dailyRate = totalAdjustedRevenue / days;
    const latePaymentBuffer = hourlyRate - baselineHourlyRate;
    const bufferPercent = baselineHourlyRate > 0 ? (latePaymentBuffer / baselineHourlyRate) * 100 : 0;
    const badDebtCost = badDebtAdjusted - grossRevenueNeeded;
    const totalLatePaymentCost = badDebtCost + latePaymentOpportunityCost + chasingTimeCost;
    const adjustedRevenueLowChasing = badDebtAdjusted + latePaymentOpportunityCost + baselineHourlyRate * 0.5;
    const adjustedRate = adjustedRevenueLowChasing / totalBillableHours;

    return { baselineHourlyRate, latePaymentBuffer, bufferPercent, hourlyRate, dailyRate, badDebtCost, latePaymentOpportunityCost, chasingTimeCost, totalLatePaymentCost, adjustedRate };
  }, [targetMonthlyIncome, workingDaysPerMonth, hoursPerDay, monthlyExpenses, taxRate, percentClientsLatePayers, avgDaysLate, percentBadDebt, hoursPerMonthChasing]);

  const totalBreakdown = out.badDebtCost + out.latePaymentOpportunityCost + out.chasingTimeCost || 1;

  return (
    <div id="calculator" className="not-prose rounded-xl border border-border bg-muted/20 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Target monthly take-home ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={targetMonthlyIncome} onChange={(e) => setTargetMonthlyIncome(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Billable days per month</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={workingDaysPerMonth} onChange={(e) => setWorkingDaysPerMonth(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Billable hours per day</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Monthly business expenses ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Estimated tax rate (%)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">% of clients who pay late</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={percentClientsLatePayers} onChange={(e) => setPercentClientsLatePayers(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Average days late</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={avgDaysLate} onChange={(e) => setAvgDaysLate(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">% annual bad debt</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={percentBadDebt} onChange={(e) => setPercentBadDebt(e.target.value)} /></label>
        <label className="text-sm md:col-span-2"><span className="mb-1 block text-muted-foreground">Hours per month spent chasing invoices</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={hoursPerMonthChasing} onChange={(e) => setHoursPerMonthChasing(e.target.value)} /></label>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-background p-4 text-sm">
        <p className="font-semibold">YOUR FREELANCE RATE BREAKDOWN</p>
        <p className="mt-2">Base rate needed: <strong>{usd(out.baselineHourlyRate)}/hr</strong></p>
        <p>Late payment buffer: <strong>+{usd(out.latePaymentBuffer)}/hr (+{out.bufferPercent.toFixed(1)}%)</strong></p>
        <p className="mt-2 border-t border-border pt-2">TRUE RATE NEEDED: <strong>{usd(out.hourlyRate)}/hr</strong></p>
        <p>Daily rate equivalent: <strong>{usd(out.dailyRate)}/day</strong></p>

        <div className="mt-4 rounded-lg border border-border p-3">
          <p className="font-semibold">📊 WHERE THE BUFFER GOES</p>
          <p>Bad debt write-offs: {usd(out.badDebtCost)}/mo</p>
          <p>Late payment opportunity: {usd(out.latePaymentOpportunityCost)}/mo</p>
          <p>Chasing time cost: {usd(out.chasingTimeCost)}/mo</p>
          <p className="mt-2 border-t border-border pt-2">Total hidden late payment cost: <strong>{usd(out.totalLatePaymentCost)}/mo</strong></p>
          <p className="mt-2">💡 If you reduced chasing time to 30 min/month, your true rate could drop to: <strong>{usd(out.adjustedRate)}/hr</strong></p>
        </div>

        <div className="mt-4">
          <p className="text-xs text-muted-foreground">Buffer breakdown</p>
          <div className="mt-1 flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="bg-red-400" style={{ width: `${(out.badDebtCost / totalBreakdown) * 100}%` }} />
            <div className="bg-amber-400" style={{ width: `${(out.latePaymentOpportunityCost / totalBreakdown) * 100}%` }} />
            <div className="bg-blue-400" style={{ width: `${(out.chasingTimeCost / totalBreakdown) * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
        You are effectively giving {out.bufferPercent.toFixed(0)}% of your rate away to late payment overhead. That is {usd(out.totalLatePaymentCost)} every month before it reaches your pocket.
      </div>
    </div>
  );
}
