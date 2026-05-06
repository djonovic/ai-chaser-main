import { useMemo, useState } from 'react';

type Due = 'Due on receipt' | 'Net 7' | 'Net 14' | 'Net 30' | 'Net 45' | 'Net 60' | 'Custom';
type LateFeeType = 'No late fee' | 'Fixed fee' | 'Monthly percentage';

function download(filename: string, text: string) {
  const element = document.createElement('a');
  element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`);
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export default function PaymentTermsGenerator() {
  const [paymentDueDays, setPaymentDueDays] = useState<Due>('Net 30');
  const [customDays, setCustomDays] = useState('30');
  const [lateFeeType, setLateFeeType] = useState<LateFeeType>('No late fee');
  const [lateFeeAmount, setLateFeeAmount] = useState('25');
  const [lateFeeAfterDays, setLateFeeAfterDays] = useState('7');
  const [lateFeePercent, setLateFeePercent] = useState('1.5');
  const [acceptedMethods, setAcceptedMethods] = useState<string[]>(['Bank transfer']);
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositPercent, setDepositPercent] = useState('50');
  const [disputeWindow, setDisputeWindow] = useState('7 days');
  const [jurisdiction, setJurisdiction] = useState('');
  const [yourBusinessName, setYourBusinessName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [variant, setVariant] = useState<'short' | 'standard' | 'detailed'>('standard');

  const methods = ['Bank transfer', 'PayPal', 'Stripe', 'Wise', 'Check', 'Credit card', 'Cryptocurrency'];

  const generated = useMemo(() => {
    const dueValue = paymentDueDays === 'Custom' ? `Net ${customDays}` : paymentDueDays;
    const dueLine =
      dueValue === 'Due on receipt'
        ? 'Payment is due upon receipt of invoice.'
        : `Payment is due within ${dueValue} of the invoice date.`;
    const lateFeeLine =
      lateFeeType === 'No late fee'
        ? ''
        : lateFeeType === 'Fixed fee'
        ? `A late payment fee of ${currency} ${lateFeeAmount} will be applied to invoices unpaid after ${lateFeeAfterDays} days.`
        : `Interest of ${lateFeePercent}% per month will accrue on balances unpaid after ${lateFeeAfterDays} days.`;
    const methodsLine = `Accepted payment methods: ${acceptedMethods.join(', ') || 'Bank transfer'}.`;
    const depositLine = depositRequired
      ? `A ${depositPercent}% deposit is required before work commences. This deposit is non-refundable.`
      : '';
    const disputeLine = `Any disputes regarding this invoice must be raised within ${disputeWindow} of the invoice date. Undisputed amounts remain payable by the due date.`;
    const jurisdictionLine = jurisdiction ? `These terms are governed by the laws of ${jurisdiction}.` : '';

    const blocks = [dueLine, lateFeeLine, methodsLine, depositLine, disputeLine, jurisdictionLine].filter(Boolean);
    const standard = blocks.join(' ');
    const short = `${dueLine} ${lateFeeLine || ''}`.trim();
    const detailed = [
      `${yourBusinessName || 'The Supplier'} payment terms:`,
      `1. ${dueLine}`,
      lateFeeLine ? `2. ${lateFeeLine}` : '',
      `3. ${methodsLine}`,
      depositLine ? `4. ${depositLine}` : '',
      `5. ${disputeLine}`,
      jurisdictionLine ? `6. ${jurisdictionLine}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return { short, standard, detailed };
  }, [
    paymentDueDays,
    customDays,
    lateFeeType,
    currency,
    lateFeeAmount,
    lateFeeAfterDays,
    lateFeePercent,
    acceptedMethods,
    depositRequired,
    depositPercent,
    disputeWindow,
    jurisdiction,
    yourBusinessName,
  ]);

  const output = generated[variant];

  return (
    <div id="calculator" className="not-prose rounded-xl border border-border bg-muted/20 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Payment due terms</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={paymentDueDays} onChange={(e) => setPaymentDueDays(e.target.value as Due)}><option>Due on receipt</option><option>Net 7</option><option>Net 14</option><option>Net 30</option><option>Net 45</option><option>Net 60</option><option>Custom</option></select></label>
        {paymentDueDays === 'Custom' && <label className="text-sm"><span className="mb-1 block text-muted-foreground">Custom days</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={customDays} onChange={(e) => setCustomDays(e.target.value)} /></label>}
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Late fee type</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={lateFeeType} onChange={(e) => setLateFeeType(e.target.value as LateFeeType)}><option>No late fee</option><option>Fixed fee</option><option>Monthly percentage</option></select></label>
        {lateFeeType === 'Fixed fee' && <label className="text-sm"><span className="mb-1 block text-muted-foreground">Fixed fee ({currency})</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={lateFeeAmount} onChange={(e) => setLateFeeAmount(e.target.value)} /></label>}
        {lateFeeType === 'Monthly percentage' && <label className="text-sm"><span className="mb-1 block text-muted-foreground">Monthly rate %</span><input type="number" step="0.1" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={lateFeePercent} onChange={(e) => setLateFeePercent(e.target.value)} /></label>}
        {lateFeeType !== 'No late fee' && <label className="text-sm"><span className="mb-1 block text-muted-foreground">Apply after (days)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={lateFeeAfterDays} onChange={(e) => setLateFeeAfterDays(e.target.value)} /></label>}
        <label className="text-sm md:col-span-2"><span className="mb-1 block text-muted-foreground">Accepted methods</span><div className="flex flex-wrap gap-3 rounded-lg border border-border bg-background p-2">{methods.map((m) => (<label key={m} className="text-xs"><input type="checkbox" className="mr-1" checked={acceptedMethods.includes(m)} onChange={(e) => setAcceptedMethods((prev) => e.target.checked ? [...prev, m] : prev.filter((v) => v !== m))} />{m}</label>))}</div></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Deposit required</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={depositRequired ? 'yes' : 'no'} onChange={(e) => setDepositRequired(e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select></label>
        {depositRequired && <label className="text-sm"><span className="mb-1 block text-muted-foreground">% deposit</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={depositPercent} onChange={(e) => setDepositPercent(e.target.value)} /></label>}
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Client must raise disputes within...</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={disputeWindow} onChange={(e) => setDisputeWindow(e.target.value)}><option>3 days</option><option>5 days</option><option>7 days</option><option>14 days</option></select></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Currency</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={currency} onChange={(e) => setCurrency(e.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>AUD</option><option>CAD</option></select></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Governing jurisdiction (optional)</span><input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="e.g. Wyoming, USA" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Your business name</span><input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="e.g. Studio North LLC" value={yourBusinessName} onChange={(e) => setYourBusinessName(e.target.value)} /></label>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" className={`rounded-lg px-3 py-2 text-sm ${variant === 'short' ? 'bg-primary text-primary-foreground' : 'border border-border'}`} onClick={() => setVariant('short')}>Short</button>
        <button type="button" className={`rounded-lg px-3 py-2 text-sm ${variant === 'standard' ? 'bg-primary text-primary-foreground' : 'border border-border'}`} onClick={() => setVariant('standard')}>Standard</button>
        <button type="button" className={`rounded-lg px-3 py-2 text-sm ${variant === 'detailed' ? 'bg-primary text-primary-foreground' : 'border border-border'}`} onClick={() => setVariant('detailed')}>Detailed</button>
      </div>
      <div className="mt-3 rounded-lg border border-border bg-background p-3">
        <pre className="whitespace-pre-wrap text-sm">{output}</pre>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => navigator.clipboard.writeText(output)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Copy payment terms</button>
        <button type="button" onClick={() => download('payment-terms.txt', output)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Download as .txt</button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Character count: {output.length}</p>
      <p className="mt-1 text-xs text-muted-foreground">These terms are a starting point. For legally binding contracts, consult a qualified attorney.</p>
    </div>
  );
}
