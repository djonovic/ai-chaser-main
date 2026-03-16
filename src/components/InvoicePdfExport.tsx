import { Button } from '@/components/ui/button';
import { Download, Crown } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { Invoice } from '@/types';

interface Props {
  invoice: Invoice;
  companyName?: string;
  senderName?: string;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateInvoiceHtml(invoice: Invoice, companyName: string, senderName: string): string {
  const statusColor =
    invoice.status === 'paid' ? '#16a34a' :
    invoice.status === 'overdue' ? '#dc2626' :
    '#3b82f6';

  const statusLabel = invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice ${invoice.invoice_number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; padding: 48px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-icon { width: 36px; height: 36px; background: #3b82f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 16px; }
  .brand-name { font-size: 20px; font-weight: 700; }
  .invoice-label { text-align: right; }
  .invoice-label h1 { font-size: 28px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; }
  .invoice-label .number { font-size: 14px; color: #64748b; margin-top: 4px; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; color: white; background: ${statusColor}; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .party h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
  .party p { font-size: 14px; line-height: 1.6; }
  .party .name { font-weight: 600; font-size: 15px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
  thead th { background: #f8fafc; text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  tbody td { padding: 14px 16px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
  .amount-col { text-align: right; font-weight: 600; }
  .total-row { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  .total-box { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px 32px; text-align: right; min-width: 220px; }
  .total-box .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
  .total-box .value { font-size: 32px; font-weight: 800; color: #1e293b; margin-top: 4px; }
  .total-box .currency { font-size: 14px; color: #64748b; margin-top: 2px; }
  .notes { background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 32px; }
  .notes h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 8px; }
  .notes p { font-size: 13px; color: #475569; line-height: 1.6; }
  .footer { text-align: center; padding-top: 32px; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 12px; }
  @media print { body { padding: 24px; } @page { margin: 0.5in; } }
</style>
</head>
<body>
<div class="header">
  <div class="brand">
    <div class="brand-icon">⚡</div>
    <span class="brand-name">${esc(companyName || 'ChaseAI')}</span>
  </div>
  <div class="invoice-label">
    <h1>Invoice</h1>
    <div class="number">${esc(invoice.invoice_number)}</div>
    <div style="margin-top: 8px;"><span class="status">${esc(statusLabel)}</span></div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <h3>From</h3>
    <p class="name">${esc(senderName || 'Your Name')}</p>
    <p>${esc(companyName || 'Your Company')}</p>
  </div>
  <div class="party" style="text-align: right;">
    <h3>Bill To</h3>
    <p class="name">${esc(invoice.client?.name || 'Client')}</p>
    <p>${esc(invoice.client?.email || '')}</p>
    ${invoice.client?.phone ? `<p>${esc(invoice.client.phone)}</p>` : ''}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Description</th>
      <th>Due Date</th>
      <th>Created</th>
      <th class="amount-col">Amount</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Invoice ${esc(invoice.invoice_number)}</td>
      <td>${new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
      <td>${new Date(invoice.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
      <td class="amount-col">${formatCurrency(invoice.amount, invoice.currency)}</td>
    </tr>
  </tbody>
</table>

<div class="total-row">
  <div class="total-box">
    <div class="label">Total Due</div>
    <div class="value">${formatCurrency(invoice.amount, invoice.currency)}</div>
    <div class="currency">${esc(invoice.currency)}</div>
  </div>
</div>

${invoice.notes ? `
<div class="notes">
  <h3>Notes</h3>
  <p>${esc(invoice.notes).replace(/\n/g, '<br/>')}</p>
</div>
` : ''}

${invoice.payment_link ? `
<div style="text-align: center; margin-bottom: 32px;">
  <a href="${esc(invoice.payment_link)}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Pay Online</a>
</div>
` : ''}

<div class="footer">
  <p>Generated by ChaseAI &middot; ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
</div>
</body>
</html>`;
}

export function InvoicePdfExport({ invoice, companyName, senderName }: Props) {
  const { isPro } = usePlan();
  const navigate = useNavigate();

  const handleExport = () => {
    if (!isPro) {
      toast.error('PDF export is available on the Pro plan');
      navigate('/pricing');
      return;
    }

    const html = generateInvoiceHtml(
      invoice,
      companyName || '',
      senderName || '',
    );

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to export PDF');
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleExport}
    >
      {isPro ? (
        <Download className="h-4 w-4" />
      ) : (
        <Crown className="h-4 w-4 text-primary" />
      )}
      Export PDF
    </Button>
  );
}
