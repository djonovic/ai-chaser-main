import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmailPreviewModal, bodyWithPaymentLink } from '@/components/EmailPreviewModal';
import {
  Zap, Loader2, Pencil, Key, Play, Pause, RotateCcw,
  Trash2, Eye, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePlan } from '@/hooks/usePlan';
import { useSequences } from '@/hooks/useSequences';
import { generateChaseSequence } from '@/lib/geminiClient';
import { getDaysOverdue } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { AILimitModal } from '@/components/AILimitModal';
import { cn } from '@/lib/utils';
import type { Invoice, SequenceStep, StepStatus } from '@/types';

const statusConfig: Record<StepStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', className: 'bg-primary/10 text-primary border-primary/30' },
  opened: { label: 'Opened', className: 'bg-warning/10 text-warning border-warning/30' },
  clicked: { label: 'Clicked', className: 'bg-success/10 text-success border-success/30' },
  replied: { label: 'Replied', className: 'bg-success/10 text-success border-success/30' },
  cancelled: { label: 'Cancelled', className: 'bg-muted/50 text-muted-foreground' },
};

interface Props {
  invoice: Invoice;
}

export function SequenceGenerator({ invoice }: Props) {
  const [generating, setGenerating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [localSteps, setLocalSteps] = useState<SequenceStep[]>([]);
  const [createdSequenceId, setCreatedSequenceId] = useState<string | null>(null);
  const [deleteStepTarget, setDeleteStepTarget] = useState<{ id: string; num: number } | null>(null);
  const [deleteSeqOpen, setDeleteSeqOpen] = useState(false);
  const [previewStep, setPreviewStep] = useState<SequenceStep | null>(null);
  const [previewEditing, setPreviewEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const lastSyncedSeqIdRef = useRef<string | null>(null);

  const {
    plan, hasUserKey, userGeminiKey, aiLimitReached,
    aiUsageCount, remainingAIUsage, maxAISequences,
    incrementAIUsage, saveUserGeminiKey,
  } = usePlan();

  const {
    sequences, steps, loading: seqLoading,
    createSequenceWithSteps, updateSequenceSteps, updateSequenceStatus,
    cancelPendingStepsForSequence, deleteStep, deleteSequence, markStepReplied,
    refetch,
  } = useSequences(invoice.id);

  const { settings } = useSettings();

  const sequence = sequences.find(s => s.invoice_id === invoice.id);
  const invoiceSteps = steps
    .filter(s => s.sequence_id === sequence?.id)
    .sort((a, b) => a.step_number - b.step_number);

  const isPaid = invoice.status === 'paid';
  const isActive = sequence?.status === 'active';
  const isCompleted = sequence?.status === 'completed';
  const isPaused = sequence?.status === 'paused';
  const isIdle = sequence?.status === 'idle';
  const hasSteps = localSteps.length > 0;
  const hasSentSteps = invoiceSteps.some(s => s.status === 'sent');

  useEffect(() => {
    if (!sequence) { setLocalSteps([]); return; }
    if (createdSequenceId && sequence.id === createdSequenceId && invoiceSteps.length > 0) {
      setLocalSteps([...invoiceSteps]);
      setCreatedSequenceId(null);
      lastSyncedSeqIdRef.current = sequence.id;
      return;
    }
    if (lastSyncedSeqIdRef.current !== sequence.id && invoiceSteps.length > 0) {
      setLocalSteps([...invoiceSteps]);
      lastSyncedSeqIdRef.current = sequence.id;
    }
    if (sequence.status !== 'idle' && invoiceSteps.length > 0) {
      setLocalSteps([...invoiceSteps]);
    }
  }, [sequence?.id, sequence?.status, createdSequenceId, invoiceSteps.length]);

  const daysOverdue = getDaysOverdue(invoice.due_date);

  const handleGenerate = useCallback(async () => {
    if (!hasUserKey && aiLimitReached) {
      setShowLimitModal(true);
      return;
    }
    setGenerating(true);
    try {
      const result = await generateChaseSequence({
        tone: 'professional',
        clientName: invoice.client?.name || 'Client',
        amount: invoice.amount,
        currency: invoice.currency,
        daysOverdue,
        invoiceNumber: invoice.invoice_number,
        dueDate: invoice.due_date,
        notes: invoice.notes || undefined,
        senderName: settings.sender_name || undefined,
        companyName: settings.company_name || undefined,
        hasPaymentLink: !!invoice.payment_link,
        userApiKey: hasUserKey ? userGeminiKey : undefined,
      });
      if (!result.steps.length) {
        toast.error('No steps generated. Please try again.');
        return;
      }
      const seq = await createSequenceWithSteps(invoice.id, 'professional', result.steps);
      if (seq) {
        setCreatedSequenceId(seq.id);
        await refetch();
        if (!result.usingUserKey) await incrementAIUsage();
      }
    } catch (err) {
      console.error('Sequence generation error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate sequence');
    } finally {
      setGenerating(false);
    }
  }, [hasUserKey, aiLimitReached, userGeminiKey, invoice, daysOverdue, settings.sender_name, settings.company_name, createSequenceWithSteps, refetch, incrementAIUsage]);

  const handleStart = async () => {
    if (!sequence || localSteps.length === 0) return;
    setStarting(true);
    try {
      const edited = localSteps.some((ls, i) => {
        const orig = invoiceSteps[i];
        return orig && (ls.subject !== orig.subject || ls.body !== orig.body || ls.send_at !== orig.send_at);
      });
      if (edited) {
        await updateSequenceSteps(
          sequence.id,
          localSteps.map(s => ({ id: s.id, subject: s.subject, body: s.body, send_at: s.send_at }))
        );
      }
      await updateSequenceStatus(sequence.id, 'active', { skipToast: true });
      toast.success('Smart Chasing started – emails will send automatically');
    } catch {
      toast.error('Failed to start chasing');
    } finally {
      setStarting(false);
    }
  };

  const handlePause = async () => {
    if (!sequence) return;
    setActionLoading('pause');
    try { await updateSequenceStatus(sequence.id, 'paused'); } finally { setActionLoading(null); }
  };

  const handleResume = async () => {
    if (!sequence) return;
    setActionLoading('resume');
    try { await updateSequenceStatus(sequence.id, 'active'); } finally { setActionLoading(null); }
  };

  const handleMarkReplied = async () => {
    if (!sequence) return;
    const latestSent = [...invoiceSteps].reverse().find(s => s.status === 'sent');
    if (!latestSent) return;
    setActionLoading('replied');
    try { await markStepReplied(latestSent.id, sequence.id); } finally { setActionLoading(null); }
  };

  const handleDeleteStep = async () => {
    if (!deleteStepTarget || !sequence) return;
    const idToRemove = deleteStepTarget.id;
    await deleteStep(idToRemove, sequence.id);
    setLocalSteps(prev => prev.filter(s => s.id !== idToRemove));
    setDeleteStepTarget(null);
  };

  const handleDeleteSequence = async () => {
    if (!sequence) return;
    await deleteSequence(sequence.id);
    setDeleteSeqOpen(false);
    setLocalSteps([]);
    lastSyncedSeqIdRef.current = null;
  };

  const handleSaveStep = async (stepId: string, subject: string, body: string, sendAt: string) => {
    setLocalSteps(prev => prev.map(s => s.id === stepId ? { ...s, subject, body, send_at: sendAt } : s));
    if (previewStep?.id === stepId) {
      setPreviewStep(prev => prev ? { ...prev, subject, body, send_at: sendAt } : prev);
    }
  };

  if (isPaid) return null;

  // Loading state
  if (generating || (seqLoading && !sequence)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Smart Chasing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-medium">Generating smart chase sequence...</p>
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  // No sequence — show generate form
  if (!sequence || (!hasSteps && isIdle)) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Smart Chasing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {hasUserKey ? (
                  <><Key className="h-3 w-3 text-success" /> Using your API key — unlimited</>
                ) : plan === 'pro' ? 'Unlimited AI sequences' : (
                  <>Usage: {aiUsageCount}/{maxAISequences ?? '∞'} this month</>
                )}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {plan.charAt(0).toUpperCase() + plan.slice(1)}
              </Badge>
            </div>
            <Button
              className="w-full gap-2 h-11 text-base bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
              onClick={() => handleGenerate()}
            >
              <Zap className="h-5 w-5" /> Generate Smart Sequence
            </Button>
            {!hasUserKey && remainingAIUsage !== null && remainingAIUsage <= 3 && remainingAIUsage > 0 && (
              <p className="text-xs text-warning text-center">
                {remainingAIUsage} AI generation{remainingAIUsage === 1 ? '' : 's'} remaining this month
              </p>
            )}
          </CardContent>
        </Card>
        <AILimitModal open={showLimitModal} onOpenChange={setShowLimitModal} onSaveKey={saveUserGeminiKey} />
      </>
    );
  }

  // Has sequence with steps — unified table view
  const displaySteps = isIdle ? localSteps : invoiceSteps;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Smart Chasing
              </CardTitle>
              {sequence && (
                <Badge variant="outline" className={cn('text-[10px]',
                  isActive && 'bg-success/10 text-success border-success/30',
                  isPaused && 'bg-warning/10 text-warning border-warning/30',
                  isCompleted && 'bg-primary/10 text-primary border-primary/30',
                  isIdle && 'bg-muted text-muted-foreground',
                )}>
                  {sequence.status.charAt(0).toUpperCase() + sequence.status.slice(1)}
                </Badge>
              )}
              {isPaused && sequence?.paused_reason === 'replied' && (
                <span className="text-xs text-muted-foreground">Client replied</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {isIdle && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleGenerate()} title="Regenerate">
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteSeqOpen(true)}
                title="Delete sequence"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            {isIdle && (
              <Button className="gap-2" onClick={handleStart} disabled={starting}>
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start Smart Chasing
              </Button>
            )}
            {isActive && (
              <Button variant="destructive" size="sm" className="gap-1.5" disabled={!!actionLoading} onClick={handlePause}>
                {actionLoading === 'pause' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                Pause
              </Button>
            )}
            {isPaused && (
              <Button size="sm" className="gap-1.5" disabled={!!actionLoading} onClick={handleResume}>
                {actionLoading === 'resume' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Resume
              </Button>
            )}
            {hasSentSteps && (
              <Button variant="outline" size="sm" className="gap-1.5" disabled={!!actionLoading} onClick={handleMarkReplied}>
                {actionLoading === 'replied' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                Mark Replied
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {displaySteps.length} step{displaySteps.length !== 1 ? 's' : ''}
              {hasUserKey ? (
                <> · <Key className="h-3 w-3 inline text-success" /> Your key</>
              ) : plan === 'pro' ? ' · Unlimited' : (
                <> · {aiUsageCount}/{maxAISequences ?? '∞'} used</>
              )}
            </span>
          </div>

          {/* Steps table */}
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead className="w-[140px]">Send Date & Time</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="hidden lg:table-cell">Preview</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displaySteps.map((step, i) => {
                  const cfg = statusConfig[step.status];
                  const editable = isIdle || step.status === 'pending';
                  return (
                    <TableRow
                      key={step.id}
                      className={cn('transition-colors cursor-pointer hover:bg-muted/40', i % 2 === 1 && 'bg-muted/20')}
                      onClick={() => { setPreviewStep(step); setPreviewEditing(false); }}
                    >
                      <TableCell className="font-medium text-muted-foreground">{step.step_number}</TableCell>
                      <TableCell className="text-xs">
                        {step.sent_at
                          ? new Date(step.sent_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                          : new Date(step.send_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium truncate max-w-[200px]">{step.subject}</p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                          {(() => {
                            const displayBody = bodyWithPaymentLink(step.body, invoice.payment_link ?? null);
                            return displayBody.length > 100 ? `${displayBody.slice(0, 100)}...` : displayBody;
                          })()}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-[10px]', cfg.className)}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setPreviewStep(step); setPreviewEditing(false); }} title="Preview">
                            <Eye className="h-3 w-3" />
                          </Button>
                          {editable && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => { setPreviewStep(step); setPreviewEditing(true); }}
                                title="Edit"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteStepTarget({ id: step.id, num: step.step_number })}
                                title="Delete step"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {isIdle && (
            <p className="text-[11px] text-muted-foreground text-center">
              Review the emails above, edit if needed, then click Start Smart Chasing.
            </p>
          )}
          {isActive && (
            <p className="text-[11px] text-muted-foreground text-center">
              Emails are sending automatically on schedule. You can pause or stop anytime.
            </p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteStepTarget !== null}
        onOpenChange={open => !open && setDeleteStepTarget(null)}
        title="Delete step"
        description={`Delete step ${deleteStepTarget?.num}? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteStep}
      />

      <ConfirmDialog
        open={deleteSeqOpen}
        onOpenChange={setDeleteSeqOpen}
        title="Delete entire sequence"
        description="This will delete the sequence and all its steps. This cannot be undone."
        confirmLabel="Delete Sequence"
        destructive
        onConfirm={handleDeleteSequence}
      />

      <EmailPreviewModal
        step={previewStep}
        open={!!previewStep}
        onOpenChange={v => { if (!v) { setPreviewStep(null); setPreviewEditing(false); } }}
        onSave={handleSaveStep}
        initialEditing={previewEditing}
        paymentLink={invoice.payment_link}
      />

      <AILimitModal open={showLimitModal} onOpenChange={setShowLimitModal} onSaveKey={saveUserGeminiKey} />
    </>
  );
}
