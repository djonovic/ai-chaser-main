import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, LogOut, User, Zap, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import { useSettings } from '@/hooks/useSettings';
import { OnboardingModal, wasOnboardingDismissed, dismissOnboarding } from '@/components/OnboardingModal';
import { InstallAppBanner } from '@/components/InstallAppBanner';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/invoices': 'Invoices & Clients',
  '/sequences': 'Sequences',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/pricing': 'Pricing',
};

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const {
    loading: planLoading,
    hasUserKey,
    aiUsageCount,
    maxAISequences,
  } = usePlan();
  const { settings, updateSettings, loading: settingsLoading } = useSettings();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const title = pageTitles[location.pathname] || 'ChaseAI';

  useEffect(() => {
    if (!loading && !user) {
      const returnTo =
        location.pathname !== '/auth'
          ? `?next=${encodeURIComponent(location.pathname + location.search)}`
          : '';
      navigate(`/auth${returnTo}`, { replace: true });
    }
  }, [loading, user, navigate, location.pathname, location.search]);

  useEffect(() => {
    if (settingsLoading || !user) return;
    const needsSetup = !settings.company_name && !settings.sender_name;
    if (needsSetup && !wasOnboardingDismissed()) {
      setShowOnboarding(true);
    }
  }, [settingsLoading, user, settings.company_name, settings.sender_name]);

  if (loading || (user && planLoading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
        <div className="relative">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Zap className="h-7 w-7 text-primary" />
          </div>
          <Loader2 className="absolute -inset-3 h-20 w-20 text-primary/30 animate-spin" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-sm font-medium text-foreground">ChaseAI</p>
          <p className="text-xs text-muted-foreground animate-pulse">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const initials = (user.user_metadata?.full_name || user.email || 'U')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out');
    navigate('/auth');
  };

  const showQuota = !hasUserKey && maxAISequences !== null;
  const usagePercent = showQuota ? Math.min(100, (aiUsageCount / (maxAISequences ?? 1)) * 100) : 0;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b px-4 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-8 w-8" />
              <h1 className="text-lg font-semibold">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* AI Usage quota badge */}
              {showQuota && (
                <Link to="/settings" className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground leading-none">
                      AI: {aiUsageCount}/{maxAISequences}
                    </span>
                    <Progress value={usagePercent} className="h-1 w-16" />
                  </div>
                </Link>
              )}
              {location.pathname !== '/invoices' && (
                <Button asChild size="sm" className="gap-2">
                  <Link to="/invoices">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">New Invoice</span>
                  </Link>
                </Button>
              )}
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="gap-2"><User className="h-4 w-4" /> Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="gap-2">
                    <LogOut className="h-4 w-4" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
          <footer className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
            © 2026 ChaseAI • All prices in USD • Cancel anytime
          </footer>
        </div>
      </div>

      <OnboardingModal
        open={showOnboarding}
        onOpenChange={(open) => {
          setShowOnboarding(open);
          if (!open) dismissOnboarding();
        }}
        onSave={async (data) => {
          await updateSettings(data);
        }}
      />
      <InstallAppBanner />
    </SidebarProvider>
  );
}
