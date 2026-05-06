import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Sequence, SequenceStep, SequenceTone, SequenceStatus } from '@/types';

export function useSequences(invoiceId?: string) {
  const { user } = useAuth();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSequences = useCallback(async () => {
    if (!user) {
      setSequences([]);
      setSteps([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase.from('sequences').select('*').eq('user_id', user.id);
      if (invoiceId) query = query.eq('invoice_id', invoiceId);

      const { data: seqData, error: seqErr } = await query.order('created_at', { ascending: false });
      if (seqErr) throw seqErr;
      setSequences(seqData || []);

      if (seqData && seqData.length > 0) {
        const ids = seqData.map(s => s.id);
        const { data: stepData, error: stepErr } = await supabase
          .from('sequence_steps')
          .select('*')
          .in('sequence_id', ids)
          .order('step_number', { ascending: true });

        if (stepErr) throw stepErr;
        setSteps(stepData || []);
      } else {
        setSteps([]);
      }
    } catch (err) {
      console.error('Error fetching sequences:', err);
      toast.error('Failed to load sequences');
    } finally {
      setLoading(false);
    }
  }, [user, invoiceId]);

  useEffect(() => { fetchSequences(); }, [fetchSequences]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    const seqChannel = supabase
      .channel('sequences-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sequences', filter: `user_id=eq.${user.id}` }, () => {
        fetchSequences();
      })
      .subscribe();

    const stepsChannel = supabase
      .channel('steps-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sequence_steps' }, () => {
        fetchSequences();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(seqChannel);
      supabase.removeChannel(stepsChannel);
    };
  }, [user, fetchSequences]);

  /** Creates one sequence + multiple steps in DB (used right after AI generation). Replaces any existing idle sequence for this invoice. */
  const createSequenceWithSteps = async (
    invId: string,
    tone: SequenceTone,
    generatedSteps: Array<{ step_number: number; day_offset: number; subject: string; body: string }>,
  ): Promise<Sequence | null> => {
    if (!user) return null;

    try {
      const existing = await supabase
        .from('sequences')
        .select('id')
        .eq('invoice_id', invId)
        .eq('user_id', user.id)
        .eq('status', 'idle')
        .maybeSingle();

      if (existing.data?.id) {
        await supabase.from('sequences').delete().eq('id', existing.data.id);
      }

      const { data: seq, error: seqErr } = await supabase
        .from('sequences')
        .insert({ invoice_id: invId, user_id: user.id, tone, status: 'idle', current_step: 0 })
        .select()
        .single();

      if (seqErr) throw seqErr;

      const now = Date.now();
      const stepsToInsert = generatedSteps.map(s => ({
        sequence_id: seq.id,
        step_number: s.step_number,
        send_at: new Date(now + s.day_offset * 86400000).toISOString(),
        subject: s.subject,
        body: s.body,
        channel: 'email' as const,
        status: 'pending' as const,
      }));

      const { error: stepsErr } = await supabase.from('sequence_steps').insert(stepsToInsert);
      if (stepsErr) throw stepsErr;

      await fetchSequences();
      return seq as Sequence;
    } catch (err) {
      console.error('Error creating sequence:', err);
      toast.error('Failed to save sequence');
      return null;
    }
  };

  /** Updates subject/body/send_at of existing sequence steps (used when user edits and clicks Save Sequence). */
  const updateSequenceSteps = async (
    sequenceId: string,
    steps: Array<{ id: string; subject: string; body: string; send_at?: string }>,
    options?: { skipToast?: boolean }
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      for (const step of steps) {
        const payload: { subject: string; body: string; send_at?: string } = {
          subject: step.subject,
          body: step.body,
        };
        if (step.send_at) payload.send_at = step.send_at;

        const { error } = await supabase
          .from('sequence_steps')
          .update(payload)
          .eq('id', step.id)
          .eq('sequence_id', sequenceId);

        if (error) throw error;
      }
      if (!options?.skipToast) {
        toast.success('Sequence saved.');
      }
      await fetchSequences();
      return true;
    } catch (err) {
      console.error('Error updating sequence steps:', err);
      toast.error('Failed to save sequence');
      return false;
    }
  };

  const updateSequenceStatus = async (sequenceId: string, status: SequenceStatus, options?: { skipToast?: boolean }) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('sequences')
        .update({ status })
        .eq('id', sequenceId)
        .eq('user_id', user.id);

      if (error) throw error;
      if (!options?.skipToast) {
        toast.success(
          status === 'active' ? 'Chasing started! Steps will be sent on schedule.' :
          status === 'paused' ? 'Sequence paused.' :
          status === 'completed' ? 'Sequence marked as completed.' : `Sequence ${status}`
        );
      }
      await fetchSequences();
    } catch (err) {
      console.error('Error updating sequence status:', err);
      toast.error('Failed to update sequence');
    }
  };

  /** Cancel all pending steps for a sequence (e.g. when invoice marked paid). */
  const cancelPendingStepsForSequence = async (sequenceId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('sequence_steps')
        .update({ status: 'cancelled' })
        .eq('sequence_id', sequenceId)
        .eq('status', 'pending');
      if (error) throw error;
      await fetchSequences();
    } catch (err) {
      console.error('Error cancelling steps:', err);
    }
  };

  const deleteStep = async (stepId: string, sequenceId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('sequence_steps')
        .delete()
        .eq('id', stepId)
        .eq('sequence_id', sequenceId);
      if (error) throw error;

      const { data: remaining } = await supabase
        .from('sequence_steps')
        .select('id')
        .eq('sequence_id', sequenceId);

      if (!remaining || remaining.length === 0) {
        await supabase.from('sequences').delete().eq('id', sequenceId);
        toast.success('Last step removed — sequence deleted');
      } else {
        toast.success('Step deleted');
      }
      await fetchSequences();
    } catch (err) {
      console.error('Error deleting step:', err);
      toast.error('Failed to delete step');
    }
  };

  const deleteSequence = async (sequenceId: string) => {
    if (!user) return;
    try {
      const { error: stepsErr } = await supabase
        .from('sequence_steps')
        .delete()
        .eq('sequence_id', sequenceId);
      if (stepsErr) throw stepsErr;

      const { error: seqErr } = await supabase
        .from('sequences')
        .delete()
        .eq('id', sequenceId)
        .eq('user_id', user.id);
      if (seqErr) throw seqErr;

      toast.success('Sequence deleted');
      await fetchSequences();
    } catch (err) {
      console.error('Error deleting sequence:', err);
      toast.error('Failed to delete sequence');
    }
  };

  const markStepReplied = async (stepId: string, sequenceId: string) => {
    if (!user) return;

    try {
      const { error: stepErr } = await supabase
        .from('sequence_steps')
        .update({ status: 'replied' })
        .eq('id', stepId);

      if (stepErr) throw stepErr;

      const { error: seqErr } = await supabase
        .from('sequences')
        .update({ status: 'paused', paused_reason: 'replied' })
        .eq('id', sequenceId);

      if (seqErr) throw seqErr;

      toast.success('Marked as replied — sequence paused');
      await fetchSequences();
    } catch (err) {
      console.error('Error marking step as replied:', err);
      toast.error('Failed to update step');
    }
  };

  return {
    sequences,
    steps,
    loading,
    createSequenceWithSteps,
    updateSequenceSteps,
    updateSequenceStatus,
    cancelPendingStepsForSequence,
    deleteStep,
    deleteSequence,
    markStepReplied,
    refetch: fetchSequences,
  };
}
