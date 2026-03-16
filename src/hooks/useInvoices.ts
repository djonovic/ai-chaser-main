import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Invoice, InvoiceStatus, PaidVia } from '@/types';

export function useInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async (): Promise<Invoice[] | undefined> => {
    if (!user) {
      setInvoices([]);
      setLoading(false);
      return undefined;
    }

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, client:clients(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list = (data || []) as Invoice[];
      setInvoices(list);
      return list;
    } catch (err) {
      console.error('Error fetching invoices:', err);
      toast.error('Failed to load invoices');
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('invoices-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `user_id=eq.${user.id}` }, async () => {
        await fetchInvoices();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchInvoices]);

  const createInvoice = async (data: {
    client_id: string;
    invoice_number: string;
    amount: number;
    currency: string;
    due_date: string;
    notes?: string;
    payment_link?: string;
  }) => {
    if (!user) return null;

    try {
      const { data: newInv, error } = await supabase
        .from('invoices')
        .insert({ ...data, user_id: user.id, status: 'draft' })
        .select('*, client:clients(*)')
        .single();

      if (error) throw error;
      toast.success('Invoice created successfully');
      return newInv;
    } catch (err) {
      console.error('Error creating invoice:', err);
      toast.error('Failed to create invoice');
      return null;
    }
  };

  const updateInvoiceStatus = async (
    id: string,
    status: InvoiceStatus,
    options?: { skipToast?: boolean; paid_via?: PaidVia }
  ) => {
    if (!user) return;

    try {
      const payload: { status: InvoiceStatus; paid_via?: PaidVia } = { status };
      if (status === 'paid' && options?.paid_via) payload.paid_via = options.paid_via;

      const { error } = await supabase
        .from('invoices')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      if (!options?.skipToast) {
        toast.success(`Invoice marked as ${status}`);
      }
    } catch (err) {
      console.error('Error updating invoice:', err);
      toast.error('Failed to update invoice');
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Invoice deleted');
    } catch (err) {
      console.error('Error deleting invoice:', err);
      toast.error('Failed to delete invoice');
    }
  };

  return { invoices, loading, createInvoice, updateInvoiceStatus, deleteInvoice, refetch: fetchInvoices };
}
