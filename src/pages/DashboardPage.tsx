import { useState, useMemo } from 'react';
import { StatsCard } from '@/components/StatsCard';
import { InvoiceStatusBadge } from '@/components/InvoiceStatusBadge';
import { AIStatusBadge } from '@/components/AIStatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { SortableTableHead } from '@/components/SortableTableHead';
import { useSortable } from '@/hooks/useSortable';
import { useInvoices } from '@/hooks/useInvoices';
import { useSequences } from '@/hooks/useSequences';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AlertCircle, DollarSign, Zap, TrendingUp, MoreHorizontal, Eye, Send, Check, Trash2 } from 'lucide-react';
import { formatCurrency, getDaysOverdue } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { invoices, loading, updateInvoiceStatus, deleteInvoice } = useInvoices();
  const { sequences } = useSequences();

  const overdueInvoices = useMemo(
    () => invoices.filter(i => i.status !== 'paid' && getDaysOverdue(i.due_date) > 0),
    [invoices]
  );
  const totalOverdue = overdueInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const recoveredThisMonth = paidInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const activeSequences = sequences.filter(s => s.status === 'active').length;

  // Calculate real success rate
  const successRate = useMemo(() => {
    const total = invoices.length;
    if (total === 0) return 0;
    return Math.round((paidInvoices.length / total) * 100);
  }, [invoices, paidInvoices]);

  const invoicesWithDays = invoices.map(inv => ({
    ...inv,
    daysOverdue: inv.status === 'paid' ? 0 : getDaysOverdue(inv.due_date),
  }));

  const { sorted, sortKey, sortDirection, onSort } = useSortable(invoicesWithDays);

  const stats = [
    { label: 'Total Overdue', value: formatCurrency(totalOverdue), trend: undefined, icon: AlertCircle, variant: 'destructive' as const },
    { label: 'Recovered This Month', value: formatCurrency(recoveredThisMonth), trend: undefined, icon: DollarSign, variant: 'success' as const },
    { label: 'Active Sequences', value: String(activeSequences), icon: Zap, variant: 'info' as const },
    { label: 'Success Rate', value: `${successRate}%`, icon: TrendingUp, variant: 'warning' as const },
  ];

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 fade-in">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => <StatsCard key={s.label} {...s} />)}
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Recent Invoices</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/invoices">View all</Link>
          </Button>
        </div>

        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Add an invoice to generate your first chase sequence and see recovery stats here."
            actionLabel="Go to Invoices"
            onAction={() => navigate('/invoices')}
          />
        ) : (
          <div className="relative overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <SortableTableHead sortKey="client.name" currentSort={sortKey} currentDirection={sortDirection} onSort={onSort}>Client</SortableTableHead>
                  <TableHead>Invoice #</TableHead>
                  <SortableTableHead sortKey="amount" currentSort={sortKey} currentDirection={sortDirection} onSort={onSort} className="hidden md:table-cell">Amount</SortableTableHead>
                  <SortableTableHead sortKey="due_date" currentSort={sortKey} currentDirection={sortDirection} onSort={onSort} className="hidden lg:table-cell">Due Date</SortableTableHead>
                  <SortableTableHead sortKey="daysOverdue" currentSort={sortKey} currentDirection={sortDirection} onSort={onSort} className="hidden lg:table-cell">Days Overdue</SortableTableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">AI Sequence</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((inv, i) => {
                  const seq = sequences.find(s => s.invoice_id === inv.id);
                  return (
                    <TableRow
                      key={inv.id}
                      className={`hover:bg-muted/50 transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-muted/20' : ''}`}
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                    >
                      <TableCell className="font-medium">{inv.client?.name || 'Unknown'}</TableCell>
                      <TableCell className="text-muted-foreground">{inv.invoice_number}</TableCell>
                      <TableCell className="hidden md:table-cell">{formatCurrency(inv.amount, inv.currency)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {inv.status === 'paid' ? (
                          <Badge variant="outline" className="text-[10px] bg-success/15 text-success border-success/30">Paid</Badge>
                        ) : inv.daysOverdue > 0 ? (
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">{inv.daysOverdue} days overdue</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">On time</span>
                        )}
                      </TableCell>
                      <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                      <TableCell className="hidden md:table-cell">
                        {seq ? <AIStatusBadge status={seq.status} /> : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild><Link to={`/invoices/${inv.id}`} className="gap-2"><Eye className="h-4 w-4" /> View</Link></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info('Navigate to invoice detail to start chasing')} className="gap-2"><Send className="h-4 w-4" /> Chase</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateInvoiceStatus(inv.id, 'paid')} className="gap-2"><Check className="h-4 w-4" /> Mark Paid</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteId(inv.id)} className="gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Invoice"
        description="Are you sure you want to delete this invoice? This action cannot be undone."
        onConfirm={() => { if (deleteId) deleteInvoice(deleteId); setDeleteId(null); }}
      />
    </div>
  );
}
