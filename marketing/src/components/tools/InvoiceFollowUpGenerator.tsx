import { useMemo, useState } from 'react';

type Tone = 'friendly' | 'polite_firm' | 'firm' | 'final_notice';

function getToneFromDays(days: number): Tone {
  if (days <= 7) return 'friendly';
  if (days <= 21) return 'polite_firm';
  if (days <= 45) return 'firm';
  return 'final_notice';
}

export default function InvoiceFollowUpGenerator() {
  const [clientName, setClientName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [daysOverdueManual, setDaysOverdueManual] = useState('');
  const [tone, setTone] = useState<Tone>('friendly');
  const [senderName, setSenderName] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [yourCompany, setYourCompany] = useState('');

  const autoDaysOverdue = useMemo(() => {
    if (!dueDate) return 0;
    const today = new Date();
    const due = new Date(dueDate);
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [dueDate]);

  const daysOverdue = Number(daysOverdueManual) || autoDaysOverdue;

  const generated = useMemo(() => {
    const safeClient = clientName || 'there';
    const safeInv = invoiceNumber || 'INV-000';
    const safeAmount = invoiceAmount || '0';
    const safeDueDate = dueDate || '[due date]';
    const safeSender = senderName || '[your name]';
    const safeCompany = yourCompany || '[company]';
    const safeLink = paymentLink || '[payment link]';

    const templates = {
      friendly: {
        subject: `Quick reminder: Invoice ${safeInv} — ${safeClient}`,
        body: `Hi ${safeClient},\n\nJust a quick heads-up that Invoice ${safeInv} for $${safeAmount} was due on ${safeDueDate}.\n\nNo worries if it's crossed in the post — here's the payment link for convenience: ${safeLink}\n\nLet me know if you have any questions.\n\nThanks,\n${safeSender}\n${safeCompany}`,
      },
      polite_firm: {
        subject: `Invoice ${safeInv} is now ${daysOverdue} days overdue — ${safeClient}`,
        body: `Hi ${safeClient},\n\nI wanted to follow up on Invoice ${safeInv} for $${safeAmount}, which was due ${daysOverdue} days ago on ${safeDueDate}.\n\nCould you let me know when we can expect payment? If there's an issue with the invoice, I'm happy to clarify.\n\nPayment can be made here: ${safeLink}\n\nThanks,\n${safeSender}\n${safeCompany}`,
      },
      firm: {
        subject: `Action required: Invoice ${safeInv} — $${safeAmount} overdue`,
        body: `Hi ${safeClient},\n\nThis is a follow-up regarding Invoice ${safeInv} for $${safeAmount}, now ${daysOverdue} days past due.\n\nPayment was due on ${safeDueDate}. Please arrange payment at your earliest convenience: ${safeLink}\n\nIf there is a specific reason for the delay, please let me know so we can discuss options.\n\nRegards,\n${safeSender}\n${safeCompany}`,
      },
      final_notice: {
        subject: `Final notice: Invoice ${safeInv} — $${safeAmount} — immediate action required`,
        body: `Dear ${safeClient},\n\nThis is a final notice regarding Invoice ${safeInv} for $${safeAmount}, which remains unpaid ${daysOverdue} days after the due date of ${safeDueDate}.\n\nPlease arrange full payment within 5 business days: ${safeLink}\n\nFailure to respond may result in escalation to a collections process or legal action in accordance with our payment terms.\n\nRegards,\n${safeSender}\n${safeCompany}`,
      },
    } as const;

    return templates[tone];
  }, [clientName, invoiceNumber, invoiceAmount, dueDate, senderName, yourCompany, paymentLink, daysOverdue, tone]);

  const wordCount = generated.body.trim().split(/\s+/).length;
  const readTimeMinutes = Math.max(1, Math.round(wordCount / 180));

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  return (
    <div id="calculator" className="not-prose rounded-xl border border-border bg-muted/20 p-5 md:p-6">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm md:col-span-2"><span className="mb-1 block text-muted-foreground">Client name or company</span><input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="e.g. Acme Ltd" value={clientName} onChange={(e) => setClientName(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Invoice number</span><input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="e.g. INV-2841" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Invoice amount ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="e.g. 3500" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Invoice due date</span><input type="date" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setTone(getToneFromDays(Number(daysOverdueManual) || autoDaysOverdue)); }} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Days overdue</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" placeholder={`${autoDaysOverdue}`} value={daysOverdueManual} onChange={(e) => { setDaysOverdueManual(e.target.value); setTone(getToneFromDays(Number(e.target.value) || autoDaysOverdue)); }} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Tone</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={tone} onChange={(e) => setTone(e.target.value as Tone)}><option value="friendly">Friendly (1–7 days)</option><option value="polite_firm">Polite but firm (8–21 days)</option><option value="firm">Firm (22–45 days)</option><option value="final_notice">Final notice (45+ days)</option></select></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Your name</span><input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="e.g. Sarah" value={senderName} onChange={(e) => setSenderName(e.target.value)} /></label>
        <label className="text-sm md:col-span-2"><span className="mb-1 block text-muted-foreground">Payment link (optional)</span><input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="e.g. stripe.com/pay/..." value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} /></label>
        <label className="text-sm md:col-span-2"><span className="mb-1 block text-muted-foreground">Your company name</span><input type="text" className="w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="e.g. Studio North" value={yourCompany} onChange={(e) => setYourCompany(e.target.value)} /></label>
      </div>

      <div className="mt-5 rounded-lg border border-border bg-background p-3">
        <p className="text-xs text-muted-foreground">Subject</p>
        <p className="mt-1 text-sm font-medium">{generated.subject}</p>
      </div>
      <div className="mt-3 rounded-lg border border-border bg-background p-3">
        <p className="text-xs text-muted-foreground">Email body</p>
        <pre className="mt-1 whitespace-pre-wrap text-sm text-foreground">{generated.body}</pre>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" onClick={() => copyText(generated.subject)}>Copy subject</button>
        <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold" onClick={() => copyText(generated.body)}>Copy email</button>
        <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold" onClick={() => copyText(`Subject: ${generated.subject}\n\n${generated.body}`)}>Copy all</button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Word count: {wordCount} · Est. read time: {readTimeMinutes} min</p>
      <p className="mt-1 text-xs text-muted-foreground">This is a starting draft — always review before sending.</p>

      <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <p>Want to automate the entire sequence — not just one email?</p>
        <a href="https://app.chaseai.app" className="mt-2 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Try Smart Chasing Free →
        </a>
      </div>
    </div>
  );
}
