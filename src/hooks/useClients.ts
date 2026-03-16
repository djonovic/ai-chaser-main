import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Client } from '@/types';

export function useClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    if (!user) {
      setClients([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const createClient = async (data: { name: string; email: string; phone?: string; notes?: string }) => {
    if (!user) return null;

    try {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({ ...data, user_id: user.id, language: 'en' })
        .select()
        .single();

      if (error) throw error;
      toast.success('Client added');
      await fetchClients();
      return newClient;
    } catch (err) {
      console.error('Error creating client:', err);
      toast.error('Failed to add client');
      return null;
    }
  };

  const updateClient = async (
    id: string,
    data: { name: string; email: string; phone?: string | null; notes?: string | null }
  ) => {
    if (!user) return null;

    try {
      const { data: updated, error } = await supabase
        .from('clients')
        .update({ name: data.name, email: data.email, phone: data.phone ?? null, notes: data.notes ?? null })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Client updated');
      await fetchClients();
      return updated;
    } catch (err) {
      console.error('Error updating client:', err);
      toast.error('Failed to update client');
      return null;
    }
  };

  const deleteClient = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('clients').delete().eq('id', id).eq('user_id', user.id);

      if (error) throw error;
      toast.success('Client deleted');
      await fetchClients();
    } catch (err) {
      console.error('Error deleting client:', err);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('foreign key') || message.includes('violates')) {
        toast.error('Cannot delete: this client has invoices. Delete their invoices first.');
      } else {
        toast.error('Failed to delete client');
      }
    }
  };

  return { clients, loading, createClient, updateClient, deleteClient, refetch: fetchClients };
}
