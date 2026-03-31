import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Zap, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { trackMetaCompleteRegistration } from '@/lib/metaPixel';

function getSafeNext(searchParams: URLSearchParams): string {
  const n = searchParams.get('next');
  if (!n) return '/dashboard';
  if (!n.startsWith('/') || n.startsWith('//') || n.includes('://')) return '/dashboard';
  return n;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, signInWithMagicLink, resetPassword, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const next = useMemo(() => getSafeNext(searchParams), [searchParams]);

  useEffect(() => {
    if (user) {
      navigate(next, { replace: true });
    }
  }, [user, next, navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = (form.get('email') as string).trim();
    const password = (form.get('password') as string) || '';

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailPattern.test(email)) {
      setLoading(false);
      toast.error('Please enter a valid email address');
      return;
    }
    if (!password) {
      setLoading(false);
      toast.error('Please enter your password');
      return;
    }

    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Sign in failed');
    } else {
      toast.success('Welcome to ChaseAI!');
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const name = (form.get('name') as string).trim();
    const email = (form.get('email') as string).trim();
    const password = (form.get('password') as string) || '';

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name) {
      setLoading(false);
      toast.error('Please enter your full name');
      return;
    }
    if (!email || !emailPattern.test(email)) {
      setLoading(false);
      toast.error('Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setLoading(false);
      toast.error('Password must be at least 8 characters');
      return;
    }

    const { error } = await signUp(email, password, name);
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Sign up failed');
    } else {
      trackMetaCompleteRegistration();
      toast.success('Account created! Check your email to confirm.');
    }
  };

  const handleMagicLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = (form.get('email') as string).trim();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailPattern.test(email)) {
      setLoading(false);
      toast.error('Please enter a valid email address');
      return;
    }

    const { error } = await signInWithMagicLink(email);
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Failed to send magic link');
    } else {
      toast.success('Magic link sent! Check your inbox.');
    }
  };

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary mb-4">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ChaseAI</h1>
          <p className="text-sm text-muted-foreground mt-1">Get paid. On time. Automatically.</p>
        </div>

        <Card>
          <Tabs defaultValue="signin">
            <CardHeader className="pb-3">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="signin" className="mt-0">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="signin-email" name="email" type="email" placeholder="you@example.com" className="pl-9" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={async () => {
                          const form = document.querySelector<HTMLFormElement>('form');
                          const emailInput = form?.querySelector<HTMLInputElement>('[name="email"]');
                          const email = emailInput?.value?.trim();
                          if (!email) { toast.warning('Enter your email first'); return; }
                          const { error } = await resetPassword(email);
                          if (error) toast.error(error.message);
                          else toast.success('Password reset email sent! Check your inbox.');
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="signin-password" name="password" type="password" placeholder="••••••••" className="pl-9" required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={loading}>
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : <>Sign In <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
                  </div>
                  <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={(e) => {
                    const form = (e.currentTarget.closest('form') as HTMLFormElement);
                    const email = (form.querySelector('[name="email"]') as HTMLInputElement)?.value;
                    if (email) handleMagicLink({ preventDefault: () => {}, currentTarget: form } as React.FormEvent<HTMLFormElement>);
                    else toast.warning('Enter your email first');
                  }}>
                    <Mail className="h-4 w-4 mr-2" /> Send Magic Link
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input id="signup-name" name="name" placeholder="John Doe" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="signup-email" name="email" type="email" placeholder="you@example.com" className="pl-9" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="signup-password" name="password" type="password" placeholder="••••••••" className="pl-9" required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={loading}>
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</> : <>Create Account <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
