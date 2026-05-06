import { useMemo, useState } from 'react';

type Step = { day: number; action: string; tone: string; channel: string; rationale: string; sample: string };

function buildBaseSequence(netDays: number): Step[] {
  return [
    { day: netDays - 5, action: 'Pre-due reminder', tone: 'Friendly', channel: 'Email', rationale: '5 days before due — gives them processing time', sample: 'Just a heads-up that invoice [X] is due in 5 days.' },
    { day: netDays + 1, action: 'Day 1 overdue: first follow-up', tone: 'Friendly', channel: 'Email', rationale: 'Catches honest oversights quickly', sample: 'Invoice [X] was due yesterday — quick check in.' },
    { day: netDays + 7, action: 'Day 7 overdue: second reminder', tone: 'Polite but firm', channel: 'Email', rationale: 'Payment has not happened naturally', sample: 'Could you confirm the payment date for invoice [X]?' },
    { day: netDays + 15, action: 'Day 15 overdue: firm notice', tone: 'Firm', channel: 'Email + Phone', rationale: 'Pattern established; add call', sample: 'Please confirm payment by [date] to avoid escalation.' },
    { day: netDays + 22, action: 'Day 22 overdue: formal notice', tone: 'Firm', channel: 'Email', rationale: 'Written record becomes important', sample: 'Formal notice: invoice [X] remains unpaid.' },
    { day: netDays + 30, action: 'Day 30 overdue: final notice', tone: 'Final notice', channel: 'Formal email', rationale: 'Last step before escalation', sample: 'Final notice before collections/legal review.' },
    { day: netDays + 37, action: 'Day 37 overdue: escalation decision', tone: 'Escalation', channel: 'Formal letter / Collections', rationale: 'Decision point: collections or legal', sample: 'Escalation decision required for invoice [X].' },
  ];
}

export default function ChasingSequenceBuilder() {
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [clientRelationship, setClientRelationship] = useState('New client');
  const [invoiceType, setInvoiceType] = useState('Service invoice');
  const [sendPreReminderBeforeDue, setSendPreReminderBeforeDue] = useState(true);
  const [edits, setEdits] = useState<Record<number, number>>({});

  const sequence = useMemo(() => {
    const amount = Number(invoiceAmount) || 0;
    const netDays = Number(paymentTermsDays) || 30;
    let steps = buildBaseSequence(netDays);

    if (!sendPreReminderBeforeDue) steps = steps.filter((s) => s.action !== 'Pre-due reminder');
    if (clientRelationship === 'Ongoing client (good history)') {
      steps = steps.map((s, i) => (i < 2 ? { ...s, day: s.day + 2 } : s));
    }
    if (clientRelationship === 'Ongoing client (has been late before)') {
      steps = steps.map((s, i) => (i >= 2 ? { ...s, day: s.day - 2, tone: i >= 3 ? 'Firm' : s.tone } : s));
    }
    if (clientRelationship === 'Large corporate / enterprise') {
      steps = steps.map((s) => ({ ...s, day: s.day + 4, rationale: `${s.rationale}. Corporate AP queues are slower.` }));
    }
    if (amount < 500) steps = steps.slice(0, 4);
    else if (amount > 5000) steps = [...steps, { day: netDays + 50, action: 'Day 50 overdue: legal review', tone: 'Escalation', channel: 'Legal', rationale: 'Large balance justifies legal review', sample: 'Initiate legal review for invoice [X].' }];

    return steps.map((s, idx) => ({ ...s, day: edits[idx] ?? s.day }));
  }, [invoiceAmount, paymentTermsDays, clientRelationship, invoiceType, sendPreReminderBeforeDue, edits]);

  const copySchedule = async () => {
    const text = sequence
      .map((s) => `Day ${s.day}: ${s.action} | Tone: ${s.tone} | Channel: ${s.channel}\n${s.sample}\nRationale: ${s.rationale}`)
      .join('\n\n');
    await navigator.clipboard.writeText(text);
  };

  return (
    <div id="calculator" className="not-prose rounded-xl border border-border bg-muted/20 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Invoice amount ($)</span><input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Payment terms (days)</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)}><option>7</option><option>14</option><option>30</option><option>45</option><option>60</option></select></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Client relationship</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={clientRelationship} onChange={(e) => setClientRelationship(e.target.value)}><option>New client</option><option>Ongoing client (good history)</option><option>Ongoing client (has been late before)</option><option>Large corporate / enterprise</option></select></label>
        <label className="text-sm"><span className="mb-1 block text-muted-foreground">Invoice type</span><select className="w-full rounded-lg border border-border bg-background px-3 py-2" value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)}><option>Service invoice</option><option>Product/delivery invoice</option><option>Retainer/recurring</option></select></label>
        <label className="text-sm md:col-span-2"><input type="checkbox" className="mr-2" checked={sendPreReminderBeforeDue} onChange={(e) => setSendPreReminderBeforeDue(e.target.checked)} />Send a reminder before due date?</label>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-muted-foreground">INVOICE FOLLOW-UP TIMELINE</p>
        {sequence.map((s, idx) => (
          <div key={`${s.action}-${idx}`} className="mt-3 border-l-2 border-border pl-4">
            <p className="font-semibold">📅 Day {s.day}</p>
            <p className="text-sm">📧 {s.action} | Tone: {s.tone} | Channel: {s.channel}</p>
            <p className="text-sm text-muted-foreground">"{s.sample}"</p>
            <p className="text-xs text-muted-foreground">{s.rationale}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Edit day:</span>
              <input type="number" className="w-20 rounded border border-border px-2 py-1 text-xs" value={s.day} onChange={(e) => setEdits((prev) => ({ ...prev, [idx]: Number(e.target.value) }))} />
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={copySchedule} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Copy full schedule</button>
      <p className="mt-3 text-sm">Want this to run automatically? ChaseAI sends each step on schedule without you lifting a finger.</p>
    </div>
  );
}
