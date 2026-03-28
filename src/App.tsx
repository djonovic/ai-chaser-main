import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { PlanProvider } from '@/contexts/PlanContext';
import { AppLayout } from '@/components/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import AuthPage from '@/pages/AuthPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import DashboardPage from '@/pages/DashboardPage';
import InvoicesPage from '@/pages/InvoicesPage';
import InvoiceDetailPage from '@/pages/InvoiceDetailPage';
import SequencesPage from '@/pages/SequencesPage';
import ClientsPage from '@/pages/ClientsPage';
import ReportsPage from '@/pages/ReportsPage';
import SettingsPage from '@/pages/SettingsPage';
import PricingPage from '@/pages/PricingPage';
import NotFound from '@/pages/NotFound';
import { MetaPixelPageViews } from '@/components/MetaPixelPageViews';
import { Analytics } from '@vercel/analytics/react';
import { App as CapacitorApp } from '@capacitor/app';
import { getMobileDeepLinkBase, isNativeMobileApp } from '@/lib/capacitor';

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    if (!isNativeMobileApp()) return;

    let removeListener: (() => Promise<void>) | undefined;
    const handleIncomingUrl = (url: string) => {
      const base = getMobileDeepLinkBase();
      if (!url.startsWith(base)) return;

      const remainder = url.slice(base.length);
      const nextPath = remainder.startsWith('/reset-password') ? '/auth/reset-password' : '/auth';

      const queryIndex = remainder.indexOf('?');
      const hashIndex = remainder.indexOf('#');
      const queryAndHash =
        queryIndex >= 0
          ? remainder.slice(queryIndex)
          : hashIndex >= 0
            ? remainder.slice(hashIndex)
            : '';

      window.location.href = `${nextPath}${queryAndHash}`;
    };

    const setupListener = async () => {
      const handle = await CapacitorApp.addListener('appUrlOpen', ({ url }) => {
        handleIncomingUrl(url);
      });

      const launchUrl = await CapacitorApp.getLaunchUrl();
      if (launchUrl?.url) {
        handleIncomingUrl(launchUrl.url);
      }

      removeListener = () => handle.remove();
    };

    void setupListener();

    return () => {
      if (removeListener) {
        void removeListener();
      }
    };
  }, []);

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <PlanProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Analytics />
              <MetaPixelPageViews />
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/invoices" element={<InvoicesPage />} />
                  <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
                  <Route path="/sequences" element={<SequencesPage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </PlanProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
