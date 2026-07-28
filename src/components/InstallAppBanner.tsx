import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Share, MoreVertical, PlusSquare, Check, MonitorSmartphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type InstallPlatform = 'ios' | 'android' | 'desktop';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'chaseai_pwa_install_dismissed';

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export function detectInstallPlatform(): InstallPlatform {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

const STEPS: Record<
  InstallPlatform,
  { title: string; description: string; steps: { icon: typeof Share; label: string; detail: string }[] }
> = {
  ios: {
    title: 'Add ChaseAI to your iPhone',
    description: 'Install from Safari so it opens like an app from your Home Screen.',
    steps: [
      {
        icon: Share,
        label: 'Open in Safari',
        detail: 'Use Safari (not Chrome or Instagram’s browser). Go to app.chaseai.app and sign in.',
      },
      {
        icon: Share,
        label: 'Tap Share',
        detail: 'Tap the Share button at the bottom of Safari (square with an arrow up).',
      },
      {
        icon: PlusSquare,
        label: 'Add to Home Screen',
        detail: 'Scroll the share sheet and tap “Add to Home Screen”, then tap Add.',
      },
    ],
  },
  android: {
    title: 'Add ChaseAI to your Android phone',
    description: 'Install from Chrome so ChaseAI appears on your home screen like an app.',
    steps: [
      {
        icon: MonitorSmartphone,
        label: 'Open in Chrome',
        detail: 'Open app.chaseai.app in Chrome and sign in.',
      },
      {
        icon: MoreVertical,
        label: 'Open the menu',
        detail: 'Tap the ⋮ menu in the top-right corner of Chrome.',
      },
      {
        icon: Download,
        label: 'Install app / Add to Home screen',
        detail: 'Tap “Install app” or “Add to Home screen”, then confirm.',
      },
    ],
  },
  desktop: {
    title: 'Install ChaseAI on your computer',
    description: 'Add it from Chrome or Edge so you can open ChaseAI from your dock or taskbar.',
    steps: [
      {
        icon: MonitorSmartphone,
        label: 'Open ChaseAI in Chrome or Edge',
        detail: 'Go to app.chaseai.app in Chrome or Microsoft Edge.',
      },
      {
        icon: Download,
        label: 'Look for Install',
        detail: 'Click the install icon in the address bar (⊕ or computer icon), or use the menu → “Install ChaseAI…”.',
      },
      {
        icon: Check,
        label: 'Confirm',
        detail: 'Click Install. ChaseAI opens in its own window, like a desktop app.',
      },
    ],
  },
};

export function InstallAppGuideContent({
  platform,
  className,
}: {
  platform?: InstallPlatform;
  className?: string;
}) {
  const resolved = platform ?? detectInstallPlatform();
  const guide = STEPS[resolved];

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <p className="text-sm font-medium">{guide.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{guide.description}</p>
      </div>
      <ol className="space-y-3">
        {guide.steps.map((step, i) => (
          <li key={step.label} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </div>
            <div className="min-w-0 pt-0.5">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <step.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {step.label}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-muted-foreground">
        After installing, open ChaseAI from your home screen / app list — no App Store needed.
      </p>
    </div>
  );
}

export function InstallAppGuideDialog({
  open,
  onOpenChange,
  platform,
  deferredPrompt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform?: InstallPlatform;
  deferredPrompt?: BeforeInstallPromptEvent | null;
}) {
  const resolved = platform ?? detectInstallPlatform();

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Install ChaseAI
          </DialogTitle>
          <DialogDescription>
            Add ChaseAI to your device for one-tap access. Here&apos;s how on your device:
          </DialogDescription>
        </DialogHeader>
        <InstallAppGuideContent platform={resolved} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
          {deferredPrompt && (
            <Button onClick={() => void handleNativeInstall()}>Install now</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Bottom banner + “Show me how” dialog. Hidden when already installed. */
export function InstallAppBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('desktop');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandaloneDisplay()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const detected = detectInstallPlatform();
    setPlatform(detected);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Always surface a tip after a short delay so users know install exists
    const t = window.setTimeout(() => setVisible(true), detected === 'ios' ? 2000 : 4000);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  if (!visible && !guideOpen) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) {
      setGuideOpen(true);
      return;
    }
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  return (
    <>
      {visible && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 md:left-auto">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Download className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Add ChaseAI to your home screen</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {platform === 'ios'
                  ? 'Install from Safari — opens like an app, no App Store.'
                  : 'Install for faster access. Works like an app, still runs in the browser.'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {deferred ? (
                  <Button size="sm" onClick={() => void install()}>
                    Install
                  </Button>
                ) : null}
                <Button size="sm" variant={deferred ? 'outline' : 'default'} onClick={() => setGuideOpen(true)}>
                  Show me how
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>
                  Not now
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={dismiss}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <InstallAppGuideDialog
        open={guideOpen}
        onOpenChange={setGuideOpen}
        platform={platform}
        deferredPrompt={deferred}
      />
    </>
  );
}
