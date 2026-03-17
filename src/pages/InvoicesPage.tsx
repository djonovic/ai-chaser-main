import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InvoiceStatusBadge } from '@/components/InvoiceStatusBadge';
import { SortableTableHead } from '@/components/SortableTableHead';
import { useSortable } from '@/hooks/useSortable';
import { TableRowSkeleton } from '@/components/DashboardSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { PdfInvoiceExtractor } from '@/components/PdfInvoiceExtractor';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { usePlan } from '@/hooks/usePlan';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, FileText, CheckCircle, Trash2, Upload } from 'lucide-react';
import { formatCurrency, getDaysOverdue } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { invoices, loading, createInvoice, updateInvoiceStatus, deleteInvoice, refetch } = useInvoices();
  const { clients, createClient } = useClients();
  const { canCreateInvoice } = usePlan();

  const [dialogTab, setDialogTab] = useState<'manual' | 'pdf'>('manual');

  // Form state
  const [formClientId, setFormClientId] = useState('');
  const [formInvoiceNum, setFormInvoiceNum] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPaymentLink, setFormPaymentLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.client?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).map(inv => ({
    ...inv,
    daysOverdue: inv.status === 'overdue' ? getDaysOverdue(inv.due_date) : 0,
  }));

  const { sorted, sortKey, sortDirection, onSort } = useSortable(filtered);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canCreateInvoice(invoices.length)) {
      toast.error('Free plan limited to 3 invoices. Upgrade to Pro for unlimited.');
      return;
    }

    const trimmedInvoiceNum = formInvoiceNum.trim();
    const trimmedAmount = formAmount.trim();
    const trimmedPaymentLink = formPaymentLink.trim();

    if (!formClientId || !trimmedInvoiceNum || !trimmedAmount || !formDueDate) {
      toast.warning('Please fill in all required fields');
      return;
    }

    const amountValue = parseFloat(trimmedAmount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }

    setSubmitting(true);
    await createInvoice({
      client_id: formClientId,
      invoice_number: trimmedInvoiceNum,
      amount: amountValue,
      currency: formCurrency,
      due_date: formDueDate,
      notes: formNotes || undefined,
      payment_link: trimmedPaymentLink || undefined,
    });
    setSubmitting(false);
    setDialogOpen(false);
    setFormClientId('');
    setFormInvoiceNum('');
    setFormAmount('');
    setFormCurrency('USD');
    setFormDueDate('');
    setFormNotes('');
    setFormPaymentLink('');
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setDialogTab('manual'); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Invoice</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
            </DialogHeader>
            <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as 'manual' | 'pdf')}>
              <TabsList className="w-full">
                <TabsTrigger value="manual" className="flex-1 gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Manual Entry
                </TabsTrigger>
                <TabsTrigger value="pdf" className="flex-1 gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Upload PDF
                </TabsTrigger>
              </TabsList>
              <TabsContent value="manual" className="mt-4">
                <form onSubmit={handleCreateInvoice} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Client *</Label>
                      <Select value={formClientId} onValueChange={setFormClientId}>
                        <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                        <SelectContent>
                          {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Invoice # *</Label>
                      <Input value={formInvoiceNum} onChange={e => setFormInvoiceNum(e.target.value)} placeholder="INV-007" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount *</Label>
                      <Input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0.00" step="0.01" />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select value={formCurrency} onValueChange={setFormCurrency}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="RSD">RSD</SelectItem>
                          <SelectItem value="CAD">CAD</SelectItem>
                          <SelectItem value="AUD">AUD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date *</Label>
                    <Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Link (optional)</Label>
                    <Input
                      value={formPaymentLink}
                      onChange={e => setFormPaymentLink(e.target.value)}
                      placeholder="https://pay.stripe.com/..."
                      type="text"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Optional Stripe or custom payment link that will be inserted into your chase emails.
                      Leave empty if you do not want to include a payment link.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes..." />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? 'Creating...' : 'Create Invoice'}
                    </Button>
                  </div>
                </form>
              </TabsContent>
              <TabsContent value="pdf" className="mt-4">
                <PdfInvoiceExtractor
                  clients={clients}
                  onSave={async (data) => {
                    if (!canCreateInvoice(invoices.length)) {
                      toast.error('Free plan limited to 3 invoices. Upgrade for unlimited.');
                      return;
                    }
                    let clientId = data.client_id;
                    if (!clientId && data.newClient) {
                      const newClient = await createClient({
                        name: data.newClient.name,
                        email: data.newClient.email,
                      });
                      if (!newClient) return;
                      clientId = newClient.id;
                    }
                    if (!clientId) {
                      toast.error('Client is required');
                      return;
                    }
                    await createInvoice({
                      client_id: clientId,
                      invoice_number: data.invoice_number,
                      amount: data.amount,
                      currency: data.currency,
                      due_date: data.due_date,
                      notes: data.notes,
                    });
                    toast.success('Invoice created from PDF – AI extracted data successfully!');
                    setDialogOpen(false);
                  }}
                  onCancel={() => setDialogOpen(false)}
                />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="p-0">
            {Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Add your first invoice to start chasing payments automatically."
            actionLabel="Add Invoice"
            onAction={() => setDialogOpen(true)}
            icon={<FileText className="h-12 w-12 text-muted-foreground/50" />}
          />
        ) : (
          <div className="relative overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <SortableTableHead sortKey="client.name" currentSort={sortKey} currentDirection={sortDirection} onSort={onSort}>Client</SortableTableHead>
                  <TableHead>Invoice #</TableHead>
                  <SortableTableHead sortKey="amount" currentSort={sortKey} currentDirection={sortDirection} onSort={onSort}>Amount</SortableTableHead>
                  <SortableTableHead sortKey="due_date" currentSort={sortKey} currentDirection={sortDirection} onSort={onSort} className="hidden md:table-cell">Due Date</SortableTableHead>
                  <SortableTableHead sortKey="daysOverdue" currentSort={sortKey} currentDirection={sortDirection} onSort={onSort} className="hidden md:table-cell">Days Overdue</SortableTableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((inv, i) => (
                  <TableRow
                    key={inv.id}
                    className={`hover:bg-muted/50 transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-muted/20' : ''}`}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                  >
                    <TableCell className="font-medium">{inv.client?.name || 'Unknown'}</TableCell>
                    <TableCell className="text-muted-foreground">{inv.invoice_number}</TableCell>
                    <TableCell>{formatCurrency(inv.amount, inv.currency)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {inv.daysOverdue > 0 ? <span className="text-destructive font-medium">{inv.daysOverdue}d</span> : '—'}
                    </TableCell>
                    <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {inv.status !== 'paid' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                            title="Mark as paid"
                            disabled={actionLoading === inv.id}
                            onClick={async () => {
                              setActionLoading(inv.id);
                              await updateInvoiceStatus(inv.id, 'paid');
                              refetch();
                              setActionLoading(null);
                            }}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete invoice"
                          disabled={actionLoading === inv.id}
                          onClick={() => setDeleteTargetId(inv.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={open => !open && setDeleteTargetId(null)}
        title="Delete invoice"
        description="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleteTargetId) {
            setActionLoading(deleteTargetId);
            await deleteInvoice(deleteTargetId);
            refetch();
            setDeleteTargetId(null);
            setActionLoading(null);
          }
        }}
      />
    </div>
  );
}
