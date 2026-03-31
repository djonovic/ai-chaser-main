import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, User, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { sender_name: string; company_name: string }) => Promise<void>;
}

const DISMISS_KEY = 'chaseai_onboarding_dismissed';

export function dismissOnboarding() {
  localStorage.setItem(DISMISS_KEY, 'true');
}

export function wasOnboardingDismissed(): boolean {
  return localStorage.getItem(DISMISS_KEY) === 'true';
}

export function OnboardingModal({ open, onOpenChange, onSave }: OnboardingModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!companyName.trim() || !senderName.trim()) {
      toast.warning('Please fill in all fields to get started');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        sender_name: senderName.trim(),
        company_name: companyName.trim(),
      });
      dismissOnboarding();
      toast.success('You\'re all set! Welcome to ChaseAI.');
      onOpenChange(false);
    } catch {
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    dismissOnboarding();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl">Welcome to ChaseAI!</DialogTitle>
          <DialogDescription className="pt-1">
            Set up your details so chase emails look professional and include your name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Company Name
            </Label>
            <Input
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Acme Corp"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Used as the signature in chase emails.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Your Name
            </Label>
            <Input
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              placeholder="John Doe"
            />
            <p className="text-[11px] text-muted-foreground">
              Used alongside your company name in the email signature.
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            You can change these anytime in Settings → Integrations.
          </p>

          <Button
            className="w-full gap-2 h-11 text-base"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : (
              <>Continue <ArrowRight className="h-4 w-4" /></>
            )}
          </Button>

          <button
            type="button"
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            onClick={handleSkip}
          >
            Skip for now — I'll set this up later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
