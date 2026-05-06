import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AIStatusBadge } from '@/components/AIStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useSequences } from '@/hooks/useSequences';
import { useInvoices } from '@/hooks/useInvoices';
import { usePlan } from '@/hooks/usePlan';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Zap, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';

export default function SequencesPage() {
  const { sequences, steps, loading, deleteSequence } = useSequences();
  const { invoices } = useInvoices();
  const { canUseAI, aiLimitReached } = usePlan();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Only show invoices that don't already have a sequence
  const invoicesWithoutSequence = invoices.filter(
    inv => !sequences.some(seq => seq.invoice_id === inv.id)
  );

  const handleCreateSequence = () => {
    if (!selectedInvoiceId) {
      toast.warning('Please select an invoice');
      return;
    }
    setDialogOpen(false);
    navigate(`/invoices/${selectedInvoiceId}`);
    toast.info('Use AI generation or pick a default template on the invoice page');
  };

  if (loading) {
    return (
      <div className="space-y-4 fade-in">
        <div className="rounded-xl border bg-card p-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full mb-2" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sequences.length} sequence{sequences.length !== 1 ? 's' : ''} created
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={invoicesWithoutSequence.length === 0}>
              <Plus className="h-4 w-4" /> New Sequence
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" /> Create Sequence
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Select an invoice to create a chase sequence with AI or templates:
              </p>
              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                <SelectTrigger><SelectValue placeholder="Select invoice..." /></SelectTrigger>
                <SelectContent>
                  {invoicesWithoutSequence.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.client?.name || 'Unknown'} ({new Intl.NumberFormat('en-US', { style: 'currency', currency: inv.currency || 'USD' }).format(Number(inv.amount))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full gap-2" onClick={handleCreateSequence}>
                <Zap className="h-4 w-4" /> Go to Invoice & Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card">
        {sequences.length === 0 ? (
          <EmptyState
            title="No sequences yet"
            description="Create your first chase sequence from an invoice detail page using AI or templates."
            actionLabel="New Sequence"
            onAction={() => setDialogOpen(true)}
            icon={<Zap className="h-12 w-12 text-muted-foreground/50" />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Tone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Steps Sent</TableHead>
                <TableHead className="hidden md:table-cell">Current Step</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[60px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sequences.map(seq => {
                const inv = invoices.find(i => i.id === seq.invoice_id);
                const seqSteps = steps.filter(s => s.sequence_id === seq.id);
                const sent = seqSteps.filter(s => s.status !== 'pending').length;
                return (
                  <TableRow
                    key={seq.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/invoices/${seq.invoice_id}`)}
                  >
                    <TableCell className="font-medium">
                      {inv?.invoice_number} — {inv?.client?.name || 'Unknown'}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{seq.tone}</Badge></TableCell>
                    <TableCell><AIStatusBadge status={seq.status} /></TableCell>
                    <TableCell className="hidden md:table-cell">{sent}/{seqSteps.length}</TableCell>
                    <TableCell className="hidden md:table-cell">{seq.current_step}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(seq.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTargetId(seq.id)}
                        title="Delete sequence"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={open => !open && setDeleteTargetId(null)}
        title="Delete sequence"
        description="This will delete the sequence and all its steps. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleteTargetId) {
            await deleteSequence(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
      />
    </div>
  );
}
