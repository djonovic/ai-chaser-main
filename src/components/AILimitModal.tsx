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
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Key, Crown, Shield, Zap, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface AILimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveKey: (key: string) => void;
}

export function AILimitModal({ open, onOpenChange, onSaveKey }: AILimitModalProps) {
  const [keyInput, setKeyInput] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const navigate = useNavigate();

  const handleSaveKey = () => {
    if (!keyInput.trim()) {
      toast.warning('Please enter a valid API key');
      return;
    }
    onSaveKey(keyInput.trim());
    toast.success('Key saved successfully!');
    setKeyInput('');
    setShowKeyInput(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-primary" />
            Unlock Unlimited AI Sequences
          </DialogTitle>
          <DialogDescription className="pt-2">
            Limit reached – add your own Gemini key or upgrade to Pro. Two options:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Option 1: Upgrade */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Crown className="h-3 w-3" /> Option 1
              </Badge>
              <span className="text-sm font-medium">Upgrade your plan</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Get more AI sequences with our key, plus premium features
            </p>
            <Button
              variant="default"
              size="sm"
              className="gap-1"
              onClick={() => {
                onOpenChange(false);
                navigate('/pricing');
              }}
            >
              <Crown className="h-3 w-3" /> View Plans
            </Button>
          </div>

          {/* Option 2: Own Key */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                <Key className="h-3 w-3" /> Option 2
              </Badge>
              <span className="text-sm font-medium">Add your own Gemini API key</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Free for most users — up to 1 million tokens/month from Google
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3 w-3 text-success shrink-0" />
                <span>Complete privacy — your key, your data</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <DollarSign className="h-3 w-3 text-success shrink-0" />
                <span>Costs almost nothing (~$0.001–0.003 per sequence)</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="h-3 w-3 text-success shrink-0" />
                <span>Takes 30 seconds to set up</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}
              >
                <ExternalLink className="h-3 w-3" /> Get Free Gemini Key
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1"
                onClick={() => setShowKeyInput(!showKeyInput)}
              >
                <Key className="h-3 w-3" /> Add My Key
              </Button>
            </div>

            {showKeyInput && (
              <div className="flex gap-2 pt-1">
                <Input
                  type="password"
                  placeholder="AIza..."
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  className="text-sm"
                />
                <Button size="sm" onClick={handleSaveKey}>Save</Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
