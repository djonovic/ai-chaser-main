import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useInvoices } from '@/hooks/useInvoices';
import { formatCurrency } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Client } from '@/types';

export default function ClientsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { clients, createClient, updateClient, deleteClient, refetch } = useClients();
  const { invoices } = useInvoices();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setEditName(client.name);
    setEditEmail(client.email);
    setEditPhone(client.phone || '');
    setEditNotes(client.notes || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedName) {
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailPattern.test(trimmedEmail)) {
      // HTML5 email input will also show an error, but we guard here too
      return;
    }

    setSubmitting(true);
    await createClient({
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone || undefined,
      notes: trimmedNotes || undefined,
    });
    setSubmitting(false);
    setDialogOpen(false);
    setName(''); setEmail(''); setPhone(''); setNotes('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    const trimmedName = editName.trim();
    const trimmedEmail = editEmail.trim();
    const trimmedPhone = editPhone.trim();
    const trimmedNotes = editNotes.trim();
    if (!trimmedName) {
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailPattern.test(trimmedEmail)) {
      return;
    }
    setEditSubmitting(true);
    await updateClient(editingClient.id, {
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone || null,
      notes: trimmedNotes || null,
    });
    setEditSubmitting(false);
    setEditingClient(null);
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Company name" required /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="billing@company.com" required /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1-555-0100" /></div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Client'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="hidden md:table-cell">Phone</TableHead>
              <TableHead># Invoices</TableHead>
              <TableHead className="hidden md:table-cell">Total Outstanding</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map(client => {
              const clientInvoices = invoices.filter(i => i.client_id === client.id);
              const outstanding = clientInvoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.amount, 0);
              const hasInvoices = clientInvoices.length > 0;
              return (
                <TableRow key={client.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-muted-foreground">{client.email}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{client.phone || '—'}</TableCell>
                  <TableCell>{clientInvoices.length}</TableCell>
                  <TableCell className="hidden md:table-cell">{formatCurrency(outstanding)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Edit client"
                        disabled={actionLoading === client.id}
                        onClick={() => openEdit(client)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={actionLoading === client.id || hasInvoices}
                              onClick={() => !hasInvoices && setDeleteTargetId(client.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {hasInvoices ? 'Delete this client\'s invoices first' : 'Delete client'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editingClient !== null} onOpenChange={open => !open && setEditingClient(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Company name" required /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" placeholder="billing@company.com" required /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+1-555-0100" /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Optional notes..." /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingClient(null)}>Cancel</Button>
              <Button type="submit" disabled={editSubmitting}>{editSubmitting ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={open => !open && setDeleteTargetId(null)}
        title="Delete client"
        description="Are you sure you want to delete this client? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleteTargetId) {
            setActionLoading(deleteTargetId);
            await deleteClient(deleteTargetId);
            refetch();
            setDeleteTargetId(null);
            setActionLoading(null);
          }
        }}
      />
    </div>
  );
}
