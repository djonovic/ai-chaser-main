import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/lib/supabaseClient';
import { usePlan } from '@/hooks/usePlan';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Eye, EyeOff, CheckCircle, Key, ExternalLink, Shield } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { trackMetaPurchase } from '@/lib/metaPixel';

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { plan, hasUserKey, userGeminiKey, saveUserGeminiKey, aiUsageCount, maxAISequences, upgradePlan } = usePlan();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [geminiKey, setGeminiKey] = useState(userGeminiKey);
  const [senderName, setSenderName] = useState(settings.sender_name);
  const [companyName, setCompanyName] = useState(settings.company_name);
  const [showGemini, setShowGemini] = useState(false);
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [email] = useState(user?.email || '');
  const [cancelSubscriptionOpen, setCancelSubscriptionOpen] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  useEffect(() => {
    setGeminiKey(userGeminiKey);
  }, [userGeminiKey]);

  useEffect(() => {
    setSenderName(settings.sender_name);
    setCompanyName(settings.company_name);
  }, [settings]);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      toast.error(`Connection failed: ${err}`);
      const next = new URLSearchParams(searchParams);
      next.delete('error');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId) return;

    const clearSessionIdFromUrl = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('session_id');
      setSearchParams(next, { replace: true });
    };

    const eventId = sessionStorage.getItem('meta_purchase_event_id');
    if (!eventId) {
      clearSessionIdFromUrl();
      return;
    }

    const sentKey = `meta_purchase_sent_${eventId}`;
    if (sessionStorage.getItem(sentKey)) {
      clearSessionIdFromUrl();
      return;
    }

    const value = Number.parseFloat(
      sessionStorage.getItem('meta_purchase_value') ?? '0',
    );
    const currency = sessionStorage.getItem('meta_purchase_currency') ?? 'USD';
    trackMetaPurchase({ eventId, value, currency });
    sessionStorage.setItem(sentKey, '1');
    sessionStorage.removeItem('meta_purchase_event_id');
    sessionStorage.removeItem('meta_purchase_value');
    sessionStorage.removeItem('meta_purchase_currency');
    clearSessionIdFromUrl();
  }, [searchParams, setSearchParams]);

  const handleSaveGeminiKey = async () => {
    await saveUserGeminiKey(geminiKey);
    toast.success('Key saved successfully!');
  };

  const tabValue = searchParams.get('tab') || 'account';
  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="w-full max-w-6xl fade-in">
      <Tabs value={tabValue} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="ai">AI Integration</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card>
            <CardHeader><CardTitle className="text-base">Account Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Full Name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={email} type="email" disabled /></div>
              <Button onClick={() => toast.success('Profile updated')}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Integration Tab */}
        <TabsContent value="ai">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Your Gemini API Key</CardTitle>
                  {hasUserKey && <CheckCircle className="h-4 w-4 text-success" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your personal key is used only for your requests. Privacy guaranteed.
                </p>

                <div className="relative">
                  <Input
                    type={showGemini ? 'text' : 'password'}
                    placeholder="AIza..."
                    value={geminiKey}
                    onChange={e => setGeminiKey(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-0 h-10 w-10"
                    onClick={() => setShowGemini(!showGemini)}
                  >
                    {showGemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveGeminiKey}>Save</Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!geminiKey) { toast.warning('Enter a key first'); return; }
                      try {
                        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
                        if (res.ok) toast.success('Gemini connection successful!');
                        else toast.error('Invalid API key');
                      } catch { toast.error('Connection failed'); }
                    }}
                  >
                    Test Connection
                  </Button>
                </div>

                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Shield className="h-4 w-4 text-primary" />
                    Why add your own key?
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                    <li>Unlimited AI sequences on any plan</li>
                    <li>Complete privacy — your data never touches our servers</li>
                    <li>Costs almost nothing (~$0.001–0.003 per sequence)</li>
                  </ul>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    How to get free key (30 seconds)
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Usage Stats */}
            <Card>
              <CardHeader><CardTitle className="text-base">AI Usage This Month</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sequences generated</span>
                  <span className="text-sm font-medium">
                    {aiUsageCount} / {maxAISequences ?? '∞'}
                  </span>
                </div>
                {maxAISequences && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (aiUsageCount / maxAISequences) * 100)}%` }}
                    />
                  </div>
                )}
                {hasUserKey && (
                  <p className="text-xs text-success flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    Using your own key — usage not counted
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Usage resets automatically every 30 days
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="flex flex-col gap-6 w-full">
            <Card className="h-fit w-full min-w-0">
              <CardHeader>
                <CardTitle className="text-base">Email Delivery</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  All chase emails are sent by ChaseAI on your behalf. No email setup required.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <p className="text-sm font-medium">How it works</p>
                  <p className="text-xs text-muted-foreground">
                    We handle email delivery for you. Your chase emails are sent from our verified domain so they land in inboxes, not spam. Just set your company name below and we'll include it in every email.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Your Name</Label>
                    <Input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="John Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Corp" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Emails will be sent as: <span className="font-medium text-foreground">
                    {senderName && companyName
                      ? `${senderName}, ${companyName}`
                      : senderName || companyName || 'ChaseAI'}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => updateSettings({ sender_name: senderName, company_name: companyName })}
                  >
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    disabled={testEmailLoading}
                    onClick={async () => {
                      setTestEmailLoading(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('send-test-email');
                        if (error) throw error;
                        if (data?.error) throw new Error(data.error);
                        toast.success('Test email sent to ' + (user?.email ?? 'your email'));
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Failed to send test email');
                      } finally {
                        setTestEmailLoading(false);
                      }
                    }}
                  >
                    {testEmailLoading ? 'Sending…' : 'Send test email'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader><CardTitle className="text-base">Current Plan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="bg-primary text-primary-foreground">
                  {plan.charAt(0).toUpperCase() + plan.slice(1)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {plan === 'pro' ? 'Unlimited invoices & AI sequences' :
                    plan === 'starter' ? 'Unlimited invoices, 50 AI sequences/mo' :
                      '3 invoices, 10 AI sequences/mo'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Upgrades are automatic. Cancel anytime.
              </p>
              <div className="flex gap-2">
                <Button asChild>
                  <Link to="/pricing">{plan === 'free' ? 'Subscribe' : 'Change Plan'}</Link>
                </Button>
                {plan !== 'free' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setCancelSubscriptionOpen(true)}
                    >
                      Cancel Subscription
                    </Button>
                    <ConfirmDialog
                      open={cancelSubscriptionOpen}
                      onOpenChange={setCancelSubscriptionOpen}
                      title="Cancel subscription?"
                      description="You will be moved to the Free plan at the end of your billing period. You will keep your current plan benefits until then. Are you sure?"
                      confirmLabel="Yes, cancel subscription"
                      destructive
                      onConfirm={async () => {
                        await upgradePlan('free');
                        setCancelSubscriptionOpen(false);
                        toast.success('Subscription cancelled. You are now on the Free plan.');
                      }}
                    />
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Cancel anytime. Questions?{' '}
                <a href="mailto:support@chaseai.app" className="text-primary hover:underline">support@chaseai.app</a>
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
