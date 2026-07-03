import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Check, Crown, Zap, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePlan } from '@/hooks/usePlan';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import type { PlanType } from '@/types';
import { openCheckoutUrl } from '@/lib/capacitor';

const plans = [
  {
    key: 'free' as PlanType,
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Get started with invoice chasing — no credit card required.',
    features: [
      '1 invoice',
      '1 sequence generation/month',
      'Automated email sending',
      'Basic dashboard',
    ],
    icon: FileText,
    highlight: false,
  },
  {
    key: 'starter' as PlanType,
    name: 'Starter',
    monthlyPrice: 9,
    annualPrice: 9,
    annualTotal: 108,
    savePercent: 0,
    description: 'For freelancers and consultants who are serious about getting paid.',
    features: [
      'Unlimited invoices',
      '50 sequence generations/month',
      'Real-time tracking',
      'Advanced recovery reports',
      'Multi-currency support',
      'PDF invoice extraction',
      'Priority email support',
    ],
    icon: Zap,
    highlight: true,
  },
  {
    key: 'pro' as PlanType,
    name: 'Pro',
    monthlyPrice: 19,
    annualPrice: 19,
    annualTotal: 228,
    savePercent: 0,
    description: 'For power users and growing teams who want no limits.',
    features: [
      'Everything in Starter',
      'Unlimited sequence generations',
      'PDF invoice export',
      'Recovery analytics dashboard',
      'Priority email support',
      'Bring your own Gemini key',
    ],
    icon: Crown,
    highlight: false,
  },
];

const planOrder: Record<PlanType, number> = { free: 0, starter: 1, pro: 2 };

export default function PricingPage() {
  const { plan } = usePlan();
  const [annual, setAnnual] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const handlePlanAction = useCallback(
    async (targetPlan: PlanType) => {
      if (targetPlan === plan) {
        navigate('/settings');
        return;
      }
      if (targetPlan === 'free') {
        navigate('/dashboard');
        return;
      }
      if (targetPlan === 'starter' || targetPlan === 'pro') {
        setCheckoutLoading(targetPlan);
        try {
          const { data, error } = await supabase.functions.invoke('create-checkout', {
            body: { plan: targetPlan, annual },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          if (data?.url) {
            await openCheckoutUrl(data.url);
            return;
          }
          throw new Error('No checkout URL returned');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to start checkout');
        } finally {
          setCheckoutLoading(null);
        }
      }
    },
    [plan, annual, navigate],
  );

  const getButtonLabel = (p: (typeof plans)[0]) => {
    const isCurrent = plan === p.key;
    if (isCurrent) return p.key === 'free' ? 'Current plan' : 'Manage subscription';
    if (p.key === 'free') return 'Start Free';
    if (plan === 'free') return 'Upgrade';
    return planOrder[p.key] > planOrder[plan] ? 'Upgrade' : 'Downgrade';
  };

  return (
    <div className="max-w-5xl mx-auto fade-in">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Simple, transparent pricing</h1>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
          Start free with 1 invoice and 1 sequence generation per month. Upgrade when you need more.
        </p>

        <div className="flex items-center justify-center gap-3 mt-6">
          <span className={cn('text-sm font-medium', !annual ? 'text-foreground' : 'text-muted-foreground')}>
            Monthly
          </span>
          <Switch checked={annual} onCheckedChange={setAnnual} />
          <span className={cn('text-sm font-medium', annual ? 'text-foreground' : 'text-muted-foreground')}>
            Annually
          </span>
          {annual && (
            <Badge variant="secondary" className="text-xs gap-1">
              Yearly billing
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const price = annual ? (p.annualPrice ?? p.monthlyPrice) : p.monthlyPrice;
          const isCurrent = plan === p.key;
          const buttonLabel = getButtonLabel(p);

          return (
            <Card
              key={p.key}
              className={cn(
                'relative flex flex-col',
                p.highlight && 'border-primary shadow-lg shadow-primary/10 scale-[1.02]',
                isCurrent && 'ring-2 ring-primary/50',
              )}
            >
              {isCurrent ? (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1 bg-primary">
                  Current Plan
                </Badge>
              ) : p.highlight ? (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1">
                  <Zap className="h-3 w-3" /> Most Popular
                </Badge>
              ) : null}

              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <p.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-3">
                  {price === 0 ? (
                    <span className="text-4xl font-bold">Free</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold">${price}</span>
                      <span className="text-muted-foreground">/mo</span>
                    </>
                  )}
                </div>
                {'annualTotal' in p && annual && p.annualTotal && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ${p.annualTotal}/year
                    {p.savePercent > 0 ? ` · Save ${p.savePercent}%` : ''}
                  </p>
                )}
                {price > 0 && !annual && 'annualTotal' in p && p.annualTotal && (
                  <p className="text-xs text-muted-foreground mt-1">
                    or ${p.annualTotal}/year billed annually
                  </p>
                )}
                {price > 0 && !annual && !('annualTotal' in p && p.annualTotal) && (
                  <p className="text-xs text-muted-foreground mt-1">Billed monthly</p>
                )}
                {price > 0 && annual && (
                  <p className="text-xs text-muted-foreground mt-1">Billed annually</p>
                )}
                {price === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">No credit card required</p>
                )}
              </CardHeader>

              <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                <ul className="space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full mt-4"
                  variant={isCurrent ? 'secondary' : p.highlight ? 'default' : 'outline'}
                  onClick={() => handlePlanAction(p.key)}
                  disabled={!!checkoutLoading}
                >
                  {checkoutLoading === p.key ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Redirecting to checkout...
                    </>
                  ) : (
                    buttonLabel
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center mt-10 space-y-2">
        <p className="text-sm text-muted-foreground">
          Add your own{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Google Gemini API key
          </a>{' '}
          in Settings to bypass AI limits on any plan.
        </p>
        <p className="text-xs text-muted-foreground">
          All paid plans include priority email support. Prices in USD. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
