import type { Invoice, SequenceTone } from '@/types';
import { getDaysOverdue } from '@/lib/utils';

export type SequenceSource = 'ai' | 'template';

export interface SequenceTemplateStep {
  step_number: number;
  day_offset: number;
  subject: string;
  body: string;
}

export interface SequenceTemplate {
  id: string;
  name: string;
  description: string;
  tone: SequenceTone;
  steps: SequenceTemplateStep[];
}

interface BuildTemplateContext {
  invoice: Invoice;
  senderName?: string | null;
  companyName?: string | null;
}

const baseSignoff = (senderName?: string | null, companyName?: string | null) => {
  if (senderName && companyName) return `${senderName}\n${companyName}`;
  if (senderName) return senderName;
  if (companyName) return companyName;
  return 'Accounts Team';
};

const paymentLine = (paymentLink: string | null) =>
  paymentLink && paymentLink.trim() ? `You can pay securely here: ${paymentLink.trim()}\n\n` : '';

export const DEFAULT_SEQUENCE_TEMPLATES: SequenceTemplate[] = [
  {
    id: 'friendly-weekly',
    name: 'Friendly Weekly Follow-up',
    description: 'Soft and relationship-first reminders across two weeks.',
    tone: 'friendly',
    steps: [
      { step_number: 1, day_offset: 0, subject: 'Quick nudge: invoice {{invoiceNumber}}', body: 'Hi {{clientName}},\n\nJust a friendly reminder that invoice {{invoiceNumber}} for {{amount}} was due on {{dueDate}}.\n\n{{paymentLine}}If payment is already in progress, please ignore this note.\n\nThanks so much,\n{{signoff}}' },
      { step_number: 2, day_offset: 3, subject: 'Following up on invoice {{invoiceNumber}}', body: 'Hi {{clientName}},\n\nChecking in again on invoice {{invoiceNumber}} ({{amount}}).\n\n{{paymentLine}}Please let me know if you need anything from my side to process it.\n\nWarmly,\n{{signoff}}' },
      { step_number: 3, day_offset: 7, subject: 'Can we confirm payment timing?', body: 'Hi {{clientName}},\n\nCould you share a quick update on payment timing for invoice {{invoiceNumber}}?\n\n{{paymentLine}}Appreciate your help getting this closed out.\n\nBest,\n{{signoff}}' },
      { step_number: 4, day_offset: 10, subject: 'Invoice {{invoiceNumber}} is still outstanding', body: 'Hi {{clientName}},\n\nInvoice {{invoiceNumber}} remains outstanding and is now {{daysOverdue}} days overdue.\n\n{{paymentLine}}Please confirm expected payment date.\n\nThank you,\n{{signoff}}' },
      { step_number: 5, day_offset: 14, subject: 'Final friendly reminder: invoice {{invoiceNumber}}', body: 'Hi {{clientName}},\n\nFinal reminder from my side for invoice {{invoiceNumber}} ({{amount}}).\n\n{{paymentLine}}Please settle this as soon as possible, or send the payment ETA today.\n\nRegards,\n{{signoff}}' },
    ],
  },
  {
    id: 'professional-standard',
    name: 'Professional Standard',
    description: 'Balanced, clear follow-ups with increasing urgency.',
    tone: 'professional',
    steps: [
      { step_number: 1, day_offset: 0, subject: 'Payment reminder: invoice {{invoiceNumber}}', body: 'Hello {{clientName}},\n\nThis is a reminder that invoice {{invoiceNumber}} for {{amount}} was due on {{dueDate}}.\n\n{{paymentLine}}Please confirm once payment is submitted.\n\nKind regards,\n{{signoff}}' },
      { step_number: 2, day_offset: 4, subject: 'Second reminder: invoice {{invoiceNumber}}', body: 'Hello {{clientName}},\n\nInvoice {{invoiceNumber}} remains unpaid.\n\n{{paymentLine}}Please process this payment at your earliest convenience.\n\nRegards,\n{{signoff}}' },
      { step_number: 3, day_offset: 8, subject: 'Action required: overdue invoice {{invoiceNumber}}', body: 'Hello {{clientName}},\n\nInvoice {{invoiceNumber}} is currently {{daysOverdue}} days overdue.\n\n{{paymentLine}}Please advise your payment date today.\n\nThank you,\n{{signoff}}' },
      { step_number: 4, day_offset: 12, subject: 'Urgent: invoice {{invoiceNumber}} still outstanding', body: 'Hello {{clientName}},\n\nThis is an urgent follow-up on unpaid invoice {{invoiceNumber}} ({{amount}}).\n\n{{paymentLine}}Please prioritise settlement and share confirmation.\n\nSincerely,\n{{signoff}}' },
      { step_number: 5, day_offset: 16, subject: 'Final notice: invoice {{invoiceNumber}}', body: 'Hello {{clientName}},\n\nDespite previous reminders, invoice {{invoiceNumber}} remains unpaid.\n\n{{paymentLine}}Please settle immediately to avoid escalation.\n\nRegards,\n{{signoff}}' },
    ],
  },
  {
    id: 'firm-escalation',
    name: 'Firm Escalation',
    description: 'Direct language for consistently late payments.',
    tone: 'firm',
    steps: [
      { step_number: 1, day_offset: 0, subject: 'Overdue payment required: invoice {{invoiceNumber}}', body: 'Hi {{clientName}},\n\nInvoice {{invoiceNumber}} is overdue and payment is now required.\n\n{{paymentLine}}Please send confirmation once paid.\n\nRegards,\n{{signoff}}' },
      { step_number: 2, day_offset: 2, subject: 'Second notice: invoice {{invoiceNumber}} overdue', body: 'Hi {{clientName}},\n\nThis is a second notice for overdue invoice {{invoiceNumber}} ({{amount}}).\n\n{{paymentLine}}Please process this without further delay.\n\n{{signoff}}' },
      { step_number: 3, day_offset: 5, subject: 'Immediate action needed: invoice {{invoiceNumber}}', body: 'Hi {{clientName}},\n\nInvoice {{invoiceNumber}} is now {{daysOverdue}} days overdue.\n\n{{paymentLine}}Please provide payment confirmation today.\n\n{{signoff}}' },
      { step_number: 4, day_offset: 9, subject: 'Final demand before escalation: invoice {{invoiceNumber}}', body: 'Hi {{clientName}},\n\nThis is a final demand for invoice {{invoiceNumber}}.\n\n{{paymentLine}}If payment is not received promptly, we will begin escalation procedures.\n\n{{signoff}}' },
      { step_number: 5, day_offset: 13, subject: 'Escalation pending: invoice {{invoiceNumber}}', body: 'Hi {{clientName}},\n\nInvoice {{invoiceNumber}} remains unpaid after multiple notices.\n\n{{paymentLine}}Settle immediately to avoid escalation.\n\n{{signoff}}' },
    ],
  },
  {
    id: 'short-3step',
    name: '3-Step Quick Sequence',
    description: 'A short sequence for low-friction chases.',
    tone: 'professional',
    steps: [
      { step_number: 1, day_offset: 0, subject: 'Reminder: invoice {{invoiceNumber}} due', body: 'Hello {{clientName}},\n\nFriendly reminder to pay invoice {{invoiceNumber}} for {{amount}}.\n\n{{paymentLine}}Many thanks,\n{{signoff}}' },
      { step_number: 2, day_offset: 5, subject: 'Follow-up: invoice {{invoiceNumber}} overdue', body: 'Hello {{clientName}},\n\nInvoice {{invoiceNumber}} is still outstanding.\n\n{{paymentLine}}Please share payment timing.\n\nRegards,\n{{signoff}}' },
      { step_number: 3, day_offset: 10, subject: 'Final reminder: invoice {{invoiceNumber}}', body: 'Hello {{clientName}},\n\nFinal reminder for unpaid invoice {{invoiceNumber}}.\n\n{{paymentLine}}Please settle as soon as possible.\n\n{{signoff}}' },
    ],
  },
  {
    id: 'net30-escalation',
    name: 'Net-30 Escalation',
    description: 'Built for clients on terms that have lapsed.',
    tone: 'professional',
    steps: [
      { step_number: 1, day_offset: 0, subject: 'Net terms exceeded: invoice {{invoiceNumber}}', body: 'Hello {{clientName}},\n\nOur payment terms for invoice {{invoiceNumber}} have now passed.\n\n{{paymentLine}}Please arrange payment immediately.\n\nRegards,\n{{signoff}}' },
      { step_number: 2, day_offset: 3, subject: 'Reminder: outstanding balance on invoice {{invoiceNumber}}', body: 'Hello {{clientName}},\n\nFollowing up on invoice {{invoiceNumber}} ({{amount}}), still unpaid.\n\n{{paymentLine}}Please provide payment confirmation.\n\n{{signoff}}' },
      { step_number: 3, day_offset: 7, subject: 'Urgent follow-up: invoice {{invoiceNumber}}', body: 'Hello {{clientName}},\n\nInvoice {{invoiceNumber}} is {{daysOverdue}} days overdue.\n\n{{paymentLine}}Please prioritise payment and confirm today.\n\n{{signoff}}' },
      { step_number: 4, day_offset: 12, subject: 'Final pre-escalation notice: invoice {{invoiceNumber}}', body: 'Hello {{clientName}},\n\nThis is a final pre-escalation notice for invoice {{invoiceNumber}}.\n\n{{paymentLine}}Kindly settle to close the matter.\n\n{{signoff}}' },
    ],
  },
  {
    id: 'humorous-light',
    name: 'Humorous (Light)',
    description: 'Gentle humor while keeping payment ask clear.',
    tone: 'humorous',
    steps: [
      { step_number: 1, day_offset: 0, subject: 'Invoice {{invoiceNumber}} says hello', body: 'Hi {{clientName}},\n\nYour invoice {{invoiceNumber}} is waving at us from the unpaid pile.\n\n{{paymentLine}}Could you give it a quick nudge?\n\nThanks,\n{{signoff}}' },
      { step_number: 2, day_offset: 4, subject: 'Still waiting on invoice {{invoiceNumber}}', body: 'Hi {{clientName}},\n\nInvoice {{invoiceNumber}} is still waiting patiently for attention.\n\n{{paymentLine}}Please let us know when payment is planned.\n\nCheers,\n{{signoff}}' },
      { step_number: 3, day_offset: 8, subject: 'Gentle ping: invoice {{invoiceNumber}}', body: 'Hi {{clientName}},\n\nQuick ping from the finance corner: invoice {{invoiceNumber}} is {{daysOverdue}} days overdue.\n\n{{paymentLine}}Would appreciate your update.\n\nBest,\n{{signoff}}' },
      { step_number: 4, day_offset: 12, subject: 'Final (friendly) ping: invoice {{invoiceNumber}}', body: 'Hi {{clientName}},\n\nLast friendly ping about invoice {{invoiceNumber}}.\n\n{{paymentLine}}Please settle now so we can retire this reminder thread.\n\nThanks,\n{{signoff}}' },
    ],
  },
  {
    id: 'final-notice-legal',
    name: 'Final Notice',
    description: 'Strong final-notice wording for difficult cases.',
    tone: 'firm',
    steps: [
      { step_number: 1, day_offset: 0, subject: 'Final notice issued: invoice {{invoiceNumber}}', body: 'Hello {{clientName}},\n\nInvoice {{invoiceNumber}} for {{amount}} is overdue and now in final notice status.\n\n{{paymentLine}}Please arrange immediate payment.\n\n{{signoff}}' },
      { step_number: 2, day_offset: 3, subject: 'Urgent: immediate settlement required ({{invoiceNumber}})', body: 'Hello {{clientName}},\n\nThis is an urgent reminder for invoice {{invoiceNumber}}, which remains unpaid.\n\n{{paymentLine}}Please provide confirmation of payment today.\n\n{{signoff}}' },
      { step_number: 3, day_offset: 6, subject: 'Final warning before escalation: {{invoiceNumber}}', body: 'Hello {{clientName}},\n\nInvoice {{invoiceNumber}} is now {{daysOverdue}} days overdue.\n\n{{paymentLine}}If unresolved, the account may be escalated.\n\n{{signoff}}' },
    ],
  },
];

export const buildSequenceFromTemplate = (
  template: SequenceTemplate,
  context: BuildTemplateContext
): Array<{ step_number: number; day_offset: number; subject: string; body: string }> => {
  const { invoice, senderName, companyName } = context;
  const clientName = invoice.client?.name || 'Client';
  const dueDate = new Date(invoice.due_date).toLocaleDateString();
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: invoice.currency || 'USD',
  }).format(Number(invoice.amount));
  const currentDaysOverdue = getDaysOverdue(invoice.due_date);
  const signoff = baseSignoff(senderName, companyName);
  const baseTokenMap: Record<string, string> = {
    '{{clientName}}': clientName,
    '{{invoiceNumber}}': invoice.invoice_number,
    '{{amount}}': amount,
    '{{dueDate}}': dueDate,
    '{{paymentLine}}': paymentLine(invoice.payment_link),
    '{{signoff}}': signoff,
  };

  const replaceTokens = (value: string, daysOverdueAtSend: number) =>
    Object.entries({
      ...baseTokenMap,
      '{{daysOverdue}}': String(daysOverdueAtSend),
    }).reduce(
      (acc, [token, tokenValue]) => acc.split(token).join(tokenValue),
      value
    );

  return template.steps.map((step) => ({
    step_number: step.step_number,
    day_offset: step.day_offset,
    subject: replaceTokens(step.subject, currentDaysOverdue + step.day_offset),
    body: replaceTokens(step.body, currentDaysOverdue + step.day_offset),
  }));
};
