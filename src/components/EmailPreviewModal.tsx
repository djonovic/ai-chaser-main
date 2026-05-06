import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mail, Pencil, Save, X, Loader2 } from 'lucide-react';
import type { SequenceStep, StepStatus } from '@/types';

const statusVariant: Record<StepStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/10 text-primary border-primary/30',
  opened: 'bg-warning/10 text-warning border-warning/30',
  clicked: 'bg-success/10 text-success border-success/30',
  replied: 'bg-success/10 text-success border-success/30',
  cancelled: 'bg-muted/50 text-muted-foreground',
};

/** Replaces {paymentLink} in step body with the actual URL for display. */
export function bodyWithPaymentLink(body: string, paymentLink: string | null | undefined): string {
  if (!body) return body;
  const trimmedLink = paymentLink?.trim();
  if (trimmedLink) {
    return body.replace(/\{paymentLink\}/g, trimmedLink);
  }
  return body
    .replace(/^.*\{paymentLink\}.*\n?/gim, '')
    .replace(/\{paymentLink\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Format ISO timestamp for datetime-local input (YYYY-MM-DDTHH:mm in local time). */
function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

interface Props {
  step: SequenceStep | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (stepId: string, subject: string, body: string, sendAt: string) => Promise<void>;
  initialEditing?: boolean;
  /** When provided, {paymentLink} in body is shown as this URL in preview (non-edit) mode. */
  paymentLink?: string | null;
}

export function EmailPreviewModal({ step, open, onOpenChange, onSave, initialEditing = false, paymentLink }: Props) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendAt, setSendAt] = useState('');
  const [saving, setSaving] = useState(false);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current && step) {
      if (initialEditing && step.status === 'pending' && onSave) {
        setSubject(step.subject);
        setBody(step.body);
        setSendAt(step.send_at ? toDateTimeLocal(step.send_at) : '');
        setEditing(true);
      } else {
        setEditing(false);
      }
    }
    prevOpenRef.current = open;
  }, [open, step, initialEditing, onSave]);

  if (!step) return null;

  const canEdit = step.status === 'pending' && !!onSave;

  const handleStartEdit = () => {
    setSubject(step.subject);
    setBody(step.body);
    setSendAt(step.send_at ? toDateTimeLocal(step.send_at) : '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      const newSendAt = sendAt ? new Date(sendAt).toISOString() : step.send_at;
      await onSave(step.id, subject, body, newSendAt);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setEditing(false); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full p-2 bg-primary/10">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg">
                Step {step.step_number} Email
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={statusVariant[step.status]}>
                  {step.status.charAt(0).toUpperCase() + step.status.slice(1)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {step.sent_at
                    ? `Sent ${new Date(step.sent_at).toLocaleString()}`
                    : `Scheduled ${new Date(step.send_at).toLocaleString()}`}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        <div className="space-y-4">
          {editing && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Send Date & Time</p>
              <Input
                type="datetime-local"
                value={sendAt}
                onChange={e => setSendAt(e.target.value)}
                className="text-sm w-[220px]"
              />
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
            {editing ? (
              <Input value={subject} onChange={e => setSubject(e.target.value)} className="text-sm" />
            ) : (
              <p className="text-base font-semibold">{step.subject}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Body</p>
            {editing ? (
              <Textarea value={body} onChange={e => setBody(e.target.value)} className="text-sm min-h-[200px]" />
            ) : (
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{bodyWithPaymentLink(step.body, paymentLink)}</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {editing ? (
            <>
              <Button variant="ghost" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              {canEdit && (
                <Button variant="outline" onClick={handleStartEdit}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              )}
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
