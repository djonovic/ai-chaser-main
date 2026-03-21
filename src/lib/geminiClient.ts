import { supabase } from '@/lib/supabaseClient';
import type { SequenceTone } from '@/types';

interface GenerateSequenceParams {
  tone: SequenceTone;
  clientName: string;
  amount: number;
  currency: string;
  daysOverdue: number;
  invoiceNumber?: string;
  dueDate?: string;
  notes?: string;
  senderName?: string;
  companyName?: string;
  hasPaymentLink?: boolean;
  userApiKey?: string;
}

interface GeneratedStep {
  step_number: number;
  day_offset: number;
  subject: string;
  body: string;
}

interface GenerateResult {
  steps: GeneratedStep[];
  usingUserKey: boolean;
}

export async function generateChaseSequence(params: GenerateSequenceParams): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke('generate-sequence', {
    body: params,
  });

  // Prefer API error message from response body, then Supabase/fetch error
  if (data?.error && typeof data.error === 'string') {
    throw new Error(data.error);
  }
  if (error) {
    throw new Error(error.message || 'Failed to generate sequence');
  }

  // Validate that steps is a proper array of sequence steps
  if (!Array.isArray(data?.steps) || data.steps.length === 0) {
    throw new Error('AI returned an invalid response. Please try again.');
  }

  // Validate each step has required fields and normalize day_offset
  const validSteps = data.steps
    .filter(
      (s: unknown): s is { step_number: number; day_offset?: number; subject: string; body: string } =>
        !!s &&
        typeof (s as Record<string, unknown>).step_number === 'number' &&
        typeof (s as Record<string, unknown>).subject === 'string' &&
        typeof (s as Record<string, unknown>).body === 'string'
    )
    .map((s) => ({
      step_number: s.step_number,
      day_offset: typeof s.day_offset === 'number' && s.day_offset >= 0 ? s.day_offset : s.step_number - 1,
      subject: s.subject,
      body: s.body,
    }));

  if (validSteps.length === 0) {
    throw new Error('AI returned malformed steps. Please try again.');
  }

  return {
    steps: validSteps,
    usingUserKey: data.usingUserKey,
  };
}
