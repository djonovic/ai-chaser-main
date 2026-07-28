import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { PlanType } from '@/types';

interface PlanLimits {
  maxInvoices: number | null;
  maxAISequences: number | null;
}

// `free` = no active subscription (pre-trial or cancelled). Product access requires Starter/Pro.
const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: { maxInvoices: 0, maxAISequences: 0 },
  starter: { maxInvoices: null, maxAISequences: 50 },
  pro: { maxInvoices: null, maxAISequences: null },
};

interface PlanContextType {
  plan: PlanType;
  isPro: boolean;
  isStarter: boolean;
  hasUserKey: boolean;
  userGeminiKey: string;
  canCreateInvoice: (currentCount: number) => boolean;
  canUseAI: () => boolean;
  aiLimitReached: boolean;
  aiUsageCount: number;
  remainingAIUsage: number | null;
  maxAISequences: number | null;
  incrementAIUsage: () => Promise<void>;
  upgradePlan: (newPlan: PlanType) => Promise<void>;
  saveUserGeminiKey: (key: string) => Promise<void>;
  refreshPlan: () => Promise<void>;
  loading: boolean;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanType>('free');
  const [aiUsageCount, setAiUsageCount] = useState(0);
  const [userGeminiKey, setUserGeminiKey] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('plan, ai_usage_count, ai_usage_reset_at, gemini_api_key')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        setLoading(false);
        return;
      }

      if (data) {
        const validPlans: PlanType[] = ['free', 'starter', 'pro'];
        if (validPlans.includes(data.plan)) setPlan(data.plan);

        const resetAt = data.ai_usage_reset_at;
        if (resetAt && new Date(resetAt) < new Date()) {
          const newReset = new Date();
          newReset.setDate(newReset.getDate() + 30);
          await supabase
            .from('profiles')
            .update({ ai_usage_count: 0, ai_usage_reset_at: newReset.toISOString() })
            .eq('id', user.id);
          setAiUsageCount(0);
        } else {
          setAiUsageCount(data.ai_usage_count || 0);
          if (!resetAt) {
            const newReset = new Date();
            newReset.setDate(newReset.getDate() + 30);
            await supabase
              .from('profiles')
              .update({ ai_usage_reset_at: newReset.toISOString() })
              .eq('id', user.id);
          }
        }

        setUserGeminiKey(data.gemini_api_key || '');
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const limits = PLAN_LIMITS[plan];
  const isPro = plan === 'pro';
  const isStarter = plan === 'starter';
  const hasUserKey = !!userGeminiKey;

  const canCreateInvoice = useCallback(
    (currentCount: number) => {
      return limits.maxInvoices === null || currentCount < limits.maxInvoices;
    },
    [limits.maxInvoices],
  );

  const canUseAI = useCallback(() => {
    if (hasUserKey) return true;
    if (limits.maxAISequences === null) return true;
    return aiUsageCount < limits.maxAISequences;
  }, [hasUserKey, limits.maxAISequences, aiUsageCount]);

  const aiLimitReached =
    !hasUserKey &&
    limits.maxAISequences !== null &&
    aiUsageCount >= limits.maxAISequences;

  const remainingAIUsage =
    limits.maxAISequences === null
      ? null
      : Math.max(0, limits.maxAISequences - aiUsageCount);

  const incrementAIUsage = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('increment_ai_usage', {
        _user_id: user.id,
      });
      if (error) {
        console.error('Error incrementing AI usage:', error);
        setAiUsageCount((prev) => prev + 1);
        return;
      }
      if (typeof data === 'number') {
        setAiUsageCount(data);
      } else {
        setAiUsageCount((prev) => prev + 1);
      }
    } catch {
      setAiUsageCount((prev) => prev + 1);
    }
  }, [user]);

  const upgradePlan = useCallback(
    async (newPlan: PlanType) => {
      if (!user) return;
      try {
        const updates: Record<string, unknown> = { plan: newPlan };
        if (newPlan !== 'free') {
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          updates.plan_expires_at = expiresAt.toISOString();
        } else {
          updates.plan_expires_at = null;
        }
        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select('plan')
          .single();

        if (error) throw error;
        if (!data) {
          toast.error(
            'Plan update had no effect. Check RLS allows UPDATE on profiles.'
          );
          return;
        }
        setPlan(data.plan as PlanType);
      } catch (err) {
        console.error('Error upgrading plan:', err);
        const message =
          err instanceof Error ? err.message : 'Failed to update plan';
        toast.error(message);
      }
    },
    [user]
  );

  const saveUserGeminiKey = useCallback(
    async (key: string) => {
      if (!user) return;
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ gemini_api_key: key || null })
          .eq('id', user.id);

        if (error) throw error;
        setUserGeminiKey(key);
      } catch (err) {
        console.error('Error saving Gemini key:', err);
        toast.error('Failed to save API key');
      }
    },
    [user]
  );

  const value: PlanContextType = {
    plan,
    isPro,
    isStarter,
    hasUserKey,
    userGeminiKey,
    canCreateInvoice,
    canUseAI,
    aiLimitReached,
    aiUsageCount,
    remainingAIUsage,
    maxAISequences: limits.maxAISequences,
    incrementAIUsage,
    upgradePlan,
    saveUserGeminiKey,
    refreshPlan: fetchProfile,
    loading,
  };

  return (
    <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx)
    throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
