import { useMemo, useState } from 'react';

type Method = 'Fixed fee' | 'Monthly percentage rate' | 'Statutory rate (UK)' | 'Statutory rate (US — no federal statutory rate, show note)';

function formatCurrency(currency: string, value: number) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export default function LateFeeCalculator() {
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [daysOverdue, setDaysOverdue] = useState('');
  const [lateFeeMethod, setLateFeeMethod] = useState<Method>('Fixed fee');
  const [fixedFeeAmount, setFixedFeeAmount] = useState('40');
  const [monthlyRate, setMonthlyRate] = useState('1.5');
  const [currency, setCurrency] = useState('USD');

  const result = useMemo(() => {
    const inv = Number(invoiceAmount) || 0;
    const days = Number(daysOverdue) || 0;
    const fixed = Number(fixedFeeAmount) || 0;
    const monthly = Number(monthlyRate) || 0;

    const monthlyRateDecimal = monthly / 100;
    const periodsElapsed = days / 30;
    const percentageFeeDue = inv * monthlyRateDecimal * periodsElapsed;
    const ukStatutoryAnnualRate = 0.1325;
    const ukStatutoryDailyRate = ukStatutoryAnnualRate / 365;
    const ukStatutoryFee = inv * ukStatutoryDailyRate * days;
    const ukDebtRecoveryCharge = inv < 1000 ? 40 : inv < 10000 ? 70 : 100;
    const fixedFeeDue = fixed;

    let lateFeeAmount = 0;
    let invoiceWording = '';

    if (lateFeeMethod === 'Fixed fee') {
      lateFeeAmount = fixedFeeDue;
      invoiceWording = `A late payment fee of ${currency}${fixedFeeDue.toFixed(2)} has been applied to this invoice, which was due ${days} days ago. New total due: ${currency}${(inv + lateFeeAmount).toFixed(2)}.`;
    } else if (lateFeeMethod === 'Monthly percentage rate') {
      lateFeeAmount = percentageFeeDue;
      invoiceWording = `Interest at ${monthly}% per month has been applied for ${days} days overdue. Late fee: ${currency}${percentageFeeDue.toFixed(2)}. New total due: ${currency}${(inv + lateFeeAmount).toFixed(2)}.`;
    } else {
      lateFeeAmount = ukStatutoryFee + ukDebtRecoveryCharge;
      invoiceWording = `Statutory interest under the Late Payment of Commercial Debts Act 1998 (${(ukStatutoryAnnualRate * 100).toFixed(2)}% per annum) has been applied. Interest: £${ukStatutoryFee.toFixed(2)}. Debt recovery charge: £${ukDebtRecoveryCharge}. New total: £${(inv + lateFeeAmount).toFixed(2)}.`;
    }

    return { lateFeeAmount, newTotalDue: inv + lateFeeAmount, invoiceWording };
  }, [invoiceAmount, daysOverdue, lateFeeMethod, fixedFeeAmount, monthlyRate, currency]);

  return (
    <div id="calculator" className="not-prose rounded-xl border border-border bg-muted/20 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Original invoice amount ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Days overdue</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={daysOverdue} onChange={(e) => setDaysOverdue(e.target.value)} /></label>
        <label className="text-sm md:col-span-2"><span className="mb-1 block text-muted-foreground">Late fee method</span><div className="flex flex-wrap gap-3 rounded-lg border border-border bg-background p-2">{(['Fixed fee', 'Monthly percentage rate', 'Statutory rate (UK)', 'Statutory rate (US — no federal statutory rate, show note)'] as Method[]).map((m) => <label key={m} className="text-xs"><input className="mr-1" type="radio" name="method" checked={lateFeeMethod === m} onChange={() => setLateFeeMethod(m)} />{m}</label>)}</div></label>
        {lateFeeMethod === 'Fixed fee' && <label className="text-sm"><span className="mb-1 block text-muted-foreground">Fixed late fee ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={fixedFeeAmount} onChange={(e) => setFixedFeeAmount(e.target.value)} /></label>}
        {lateFeeMethod === 'Monthly percentage rate' && <label className="text-sm"><span className="mb-1 block text-muted-foreground">Monthly interest rate (%)</span><input type="number" step="0.1" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} /><span className="mt-1 block text-xs text-muted-foreground">Common range: 1–2% per month</span></label>}
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Currency</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={currency} onChange={(e) => setCurrency(e.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>AUD</option><option>CAD</option></select></label>
      </div>
      {lateFeeMethod.includes('US') && <p className="mt-2 text-xs text-amber-700">US note: there is no federal statutory late-payment interest rate. State laws vary.</p>}
      {lateFeeMethod === 'Statutory rate (UK)' && <p className="mt-2 text-xs text-muted-foreground">UK statutory rate = Bank of England base rate + 8%. Check current BoE base rate at bankofengland.co.uk before applying.</p>}

      <div className="mt-5 rounded-xl border border-border bg-background p-4">
        <p className="text-sm font-semibold">LATE FEE CALCULATION</p>
        <p className="mt-2 text-sm">Original invoice: <strong>{formatCurrency(currency, Number(invoiceAmount) || 0)}</strong></p>
        <p className="text-sm">Late fee applied: <strong>{formatCurrency(currency, result.lateFeeAmount)}</strong></p>
        <p className="mt-2 border-t border-border pt-2 text-sm">New total due: <strong>{formatCurrency(currency, result.newTotalDue)}</strong></p>
        <div className="mt-4 rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">📋 INVOICE WORDING (copy-paste ready)</p>
          <p className="mt-1 text-sm">{result.invoiceWording}</p>
          <button type="button" onClick={() => navigator.clipboard.writeText(result.invoiceWording)} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Copy wording</button>
        </div>
      </div>
    </div>
  );
}
