export type InvoiceStatus = 'draft' | 'sent' | 'overdue' | 'paid' | 'cancelled';
export type SequenceTone = 'friendly' | 'professional' | 'firm' | 'humorous';
export type SequenceStatus = 'idle' | 'active' | 'paused' | 'completed';
export type StepChannel = 'email' | 'sms';
export type StepStatus = 'pending' | 'sent' | 'opened' | 'clicked' | 'replied' | 'cancelled';
export type PlanType = 'free' | 'starter' | 'pro';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  plan: PlanType;
  plan_expires_at: string | null;
  ai_usage_count: number;
  ai_usage_reset_at: string | null;
  gemini_api_key: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  language: string;
  notes: string | null;
  created_at: string;
}

export type PaidVia = 'manual';

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  due_date: string;
  status: InvoiceStatus;
  paid_via?: PaidVia | null;
  payment_link: string | null;
  pdf_url: string | null;
  notes: string | null;
  created_at: string;
  client?: Client;
  sequence?: Sequence;
}

export interface Sequence {
  id: string;
  invoice_id: string;
  user_id: string;
  tone: SequenceTone;
  status: SequenceStatus;
  current_step: number;
  paused_reason?: string | null;
  created_at: string;
  steps?: SequenceStep[];
}

export interface SequenceStep {
  id: string;
  sequence_id: string;
  step_number: number;
  send_at: string;
  subject: string;
  body: string;
  channel: StepChannel;
  status: StepStatus;
  sent_at: string | null;
}

export interface Settings {
  id: string;
  user_id: string;
  gemini_api_key: string | null;
  resend_api_key: string | null;
  sender_name: string | null;
  company_name: string | null;
  sms_enabled: boolean;
  timezone: string;
}

export interface StatsCardData {
  label: string;
  value: string;
  trend?: number;
  icon: React.ComponentType<{ className?: string }>;
  variant: 'destructive' | 'success' | 'info' | 'warning';
}
