import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Check, Crown, Zap, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePlan } from '@/hooks/usePlan';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import type { PlanType } from '@/types';
import { trackMetaInitiateCheckout } from '@/lib/metaPixel';

const MARKETING_SITE_URL = 'https://chaseai.app';

const checkoutPlans = [
  {
    key: 'starter' as PlanType,
    name: 'Starter',
    monthlyPrice: 29,
    annualPrice: 24,
    annualTotal: 288,
    savePercent: 17,
    description: 'For freelancers and consultants who are serious about getting paid.',
    features: [
      'Unlimited invoices',
      '50 AI sequence generations/month',
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
    monthlyPrice: 49,
    annualPrice: 39,
    annualTotal: 468,
    savePercent: 20,
    description: 'For power users and growing teams who want no limits.',
    features: [
      'Everything in Starter',
      'Unlimited AI sequence generations',
      'PDF invoice export',
      'Recovery analytics dashboard',
      'Priority email support',
      'Bring your own Gemini key',
    ],
    icon: Crown,
    highlight: false,
  },
];

const enterprisePlan = {
  name: 'Enterprise',
  description: 'For teams that need accounting sync, reply automation, and dedicated onboarding.',
  features: [
    'Everything in Pro',
    'QuickBooks integration',
    'Xero integration',
    'Mail reply detection & workflows',
    'Dedicated onboarding & support',
  ],
  icon: Building2,
};

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
      if (targetPlan === 'starter' || targetPlan === 'pro') {
        setCheckoutLoading(targetPlan);
        try {
          const { data, error } = await supabase.functions.invoke('create-checkout', {
            body: { plan: targetPlan, annual },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          if (data?.url) {
            const p = checkoutPlans.find((x) => x.key === targetPlan);
            if (p) {
              const value =
                annual && p.annualTotal != null ? p.annualTotal : p.monthlyPrice;
              const metaEventId = (data as { metaEventId?: string }).metaEventId;
              if (metaEventId) {
                sessionStorage.setItem('meta_purchase_event_id', metaEventId);
                sessionStorage.setItem('meta_purchase_value', String(value));
                sessionStorage.setItem('meta_purchase_currency', 'USD');
              }
              trackMetaInitiateCheckout({
                value,
                currency: 'USD',
                plan: targetPlan,
              });
            }
            window.location.href = data.url;
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

  const getButtonLabel = (p: (typeof checkoutPlans)[0]) => {
    const isCurrent = plan === p.key;
    if (isCurrent) return 'Manage subscription';
    if (plan === 'free') return 'Subscribe';
    return planOrder[p.key] > planOrder[plan] ? 'Upgrade' : 'Downgrade';
  };

  return (
    <div className="max-w-5xl mx-auto fade-in">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Simple, transparent pricing</h1>
        <p className="text-muted-foreground mt-2">
          Subscribe to Starter or Pro here. Need QuickBooks, Xero, or mail reply workflows?{' '}
          <a
            href={`${MARKETING_SITE_URL}/contact`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            Contact us
          </a>{' '}
          for Enterprise.
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
              Save 17–20%
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {checkoutPlans.map((p) => {
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
                  <span className="text-4xl font-bold">${price}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                {annual && p.annualTotal && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ${p.annualTotal}/year · Save {p.savePercent}%
                  </p>
                )}
                {!annual && (
                  <p className="text-xs text-muted-foreground mt-1">Billed monthly</p>
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

        <Card className="relative flex flex-col border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 mb-1">
              <enterprisePlan.icon className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{enterprisePlan.name}</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">{enterprisePlan.description}</p>
            <div className="mt-3">
              <span className="text-4xl font-bold">Custom</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Scoped with our team</p>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col justify-between space-y-4">
            <ul className="space-y-2.5">
              {enterprisePlan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Button className="w-full mt-4" variant="outline" asChild>
              <a href={`${MARKETING_SITE_URL}/contact`} target="_blank" rel="noopener noreferrer">
                Contact us
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-center mt-10 space-y-2">
        <p className="text-sm text-muted-foreground">
          💡 Tip: Add your own{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Google Gemini API key
          </a>{' '}
          in Settings to bypass AI limits on Starter and Pro.
        </p>
        <p className="text-xs text-muted-foreground">
          All paid plans include priority email support. Prices in USD. Cancel anytime on Starter and Pro.
        </p>
      </div>
    </div>
  );
}
