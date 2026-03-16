import { useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SequenceGenerator } from '@/components/SequenceGenerator';
import { InvoicePdfExport } from '@/components/InvoicePdfExport';
import { useInvoices } from '@/hooks/useInvoices';
import { useSequences } from '@/hooks/useSequences';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, getDaysOverdue, getDaysUntilDue } from '@/lib/utils';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect, useRef } from 'react';

function InvoiceDetailSkeleton() {
  return (
    <div className="space-y-6 fade-in">
      <Skeleton className="h-8 w-24" />
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="grid grid-cols-4 gap-4 pt-4 border-t">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const { invoices, loading: invoicesLoading, updateInvoiceStatus } = useInvoices();
  const {
    sequences, steps, loading: seqLoading,
    updateSequenceStatus, cancelPendingStepsForSequence,
  } = useSequences(id);
  const { settings } = useSettings();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const prevSentCountRef = useRef(0);
  const mountedRef = useRef(false);

  const loading = invoicesLoading || seqLoading;

  useEffect(() => { mountedRef.current = true; }, []);

  const sequence = sequences.find(s => s.invoice_id === id);
  const invoiceSteps = steps
    .filter(s => s.sequence_id === sequence?.id)
    .sort((a, b) => a.step_number - b.step_number);

  useEffect(() => {
    const sentCount = invoiceSteps.filter(s => s.status === 'sent').length;
    if (mountedRef.current && sentCount > prevSentCountRef.current && prevSentCountRef.current > 0) {
      toast.success('Chase email sent');
    }
    prevSentCountRef.current = sentCount;
  }, [invoiceSteps]);

  if (loading) return <InvoiceDetailSkeleton />;

  const invoice = invoices.find(i => i.id === id);

  if (!invoice) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Invoice not found</p>
        <Button asChild variant="link" className="mt-2"><Link to="/invoices">Back to Invoices</Link></Button>
      </div>
    );
  }

  const daysOverdue = invoice.status === 'paid' ? 0 : getDaysOverdue(invoice.due_date);
  const daysUntilDue = getDaysUntilDue(invoice.due_date);
  const isOverdue = daysOverdue > 0;
  const isPaid = invoice.status === 'paid';

  const handleMarkPaid = async () => {
    setActionLoading('paid');
    try {
      await updateInvoiceStatus(invoice.id, 'paid', { skipToast: true, paid_via: 'manual' });
      if (sequence && (sequence.status === 'active' || sequence.status === 'idle')) {
        await updateSequenceStatus(sequence.id, 'completed', { skipToast: true });
        await cancelPendingStepsForSequence(sequence.id);
      }
      toast.success('Invoice marked as Paid – chasing stopped');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 fade-in w-full">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/invoices"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
        <InvoicePdfExport
          invoice={invoice}
          companyName={settings.company_name}
          senderName={settings.sender_name}
        />
      </div>

      {/* Invoice Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold">{invoice.invoice_number}</h2>
              <p className="text-muted-foreground text-sm truncate">{invoice.client?.name} · {invoice.client?.email}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap justify-end">
              {isPaid ? (
                <Badge variant="outline" className="text-sm sm:text-base px-3 sm:px-4 py-1 sm:py-1.5 bg-success/15 text-success border-success/30 font-semibold">
                  <Check className="h-4 w-4 mr-1" /> PAID
                </Badge>
              ) : (
                <>
                  {isOverdue ? (
                    <Badge variant="outline" className="hidden sm:inline-flex text-base px-3 py-1 bg-destructive/15 text-destructive border-destructive/30 font-medium">Overdue by {daysOverdue} days</Badge>
                  ) : daysUntilDue > 0 ? (
                    <Badge variant="outline" className="hidden sm:inline-flex text-base px-3 py-1 bg-warning/15 text-warning border-warning/30 font-medium">Due in {daysUntilDue} days</Badge>
                  ) : (
                    <Badge variant="outline" className="hidden sm:inline-flex text-base px-3 py-1 bg-muted text-muted-foreground border-border font-medium">Due today</Badge>
                  )}
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white sm:gap-2"
                    disabled={!!actionLoading}
                    onClick={handleMarkPaid}
                  >
                    {actionLoading === 'paid' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    <span className="hidden sm:inline">Mark as</span> Paid
                  </Button>
                </>
              )}
            </div>
          </div>
          {!isPaid && (
            <div className="sm:hidden mt-2">
              {isOverdue ? (
                <Badge variant="outline" className="text-sm px-3 py-1 bg-destructive/15 text-destructive border-destructive/30 font-medium">Overdue by {daysOverdue} days</Badge>
              ) : daysUntilDue > 0 ? (
                <Badge variant="outline" className="text-sm px-3 py-1 bg-warning/15 text-warning border-warning/30 font-medium">Due in {daysUntilDue} days</Badge>
              ) : (
                <Badge variant="outline" className="text-sm px-3 py-1 bg-muted text-muted-foreground border-border font-medium">Due today</Badge>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="text-lg font-semibold">{formatCurrency(invoice.amount, invoice.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due Date</p>
              <p className="text-lg font-semibold">{new Date(invoice.due_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Currency</p>
              <p className="text-lg font-semibold">{invoice.currency}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-lg font-semibold">{new Date(invoice.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          {invoice.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single unified sequence section */}
      <SequenceGenerator invoice={invoice} />
    </div>
  );
}
