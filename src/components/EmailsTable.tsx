import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Mail, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmailPreviewModal } from '@/components/EmailPreviewModal';
import { cn } from '@/lib/utils';
import type { SequenceStep, StepStatus } from '@/types';

const statusConfig: Record<StepStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', className: 'bg-primary/10 text-primary border-primary/30' },
  opened: { label: 'Opened', className: 'bg-warning/10 text-warning border-warning/30' },
  clicked: { label: 'Clicked', className: 'bg-success/10 text-success border-success/30' },
  replied: { label: 'Replied', className: 'bg-success/10 text-success border-success/30' },
  cancelled: { label: 'Cancelled', className: 'bg-muted/50 text-muted-foreground' },
};

interface Props {
  steps: SequenceStep[];
  onSaveStep?: (stepId: string, subject: string, body: string) => Promise<void>;
}

export function EmailsTable({ steps, onSaveStep }: Props) {
  const [previewStep, setPreviewStep] = useState<SequenceStep | null>(null);

  const sorted = [...steps].sort((a, b) => a.step_number - b.step_number);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Sent & Planned Emails</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                All scheduled and sent emails for this invoice. Click Preview to see the full email content.
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No emails yet. Generate a sequence to start.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead className="w-[110px]">Planned</TableHead>
                    <TableHead className="w-[110px]">Sent</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="hidden lg:table-cell">Body Preview</TableHead>
                    <TableHead className="w-[90px]">Status</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((step, i) => {
                    const cfg = statusConfig[step.status];
                    const bodyPreview = step.body.length > 120 ? step.body.slice(0, 120) + '...' : step.body;
                    return (
                      <TableRow
                        key={step.id}
                        className={cn(
                          'transition-colors',
                          i % 2 === 1 && 'bg-muted/20',
                          step.status === 'sent' && 'bg-primary/[0.02]',
                        )}
                      >
                        <TableCell className="font-medium text-muted-foreground">{step.step_number}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(step.send_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-xs">
                          {step.sent_at ? new Date(step.sent_at).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium truncate max-w-[200px]">{step.subject}</p>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <p className="text-xs text-muted-foreground truncate max-w-[250px]">{bodyPreview}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-[10px]', cfg.className)}>
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 gap-1 text-xs"
                            onClick={() => setPreviewStep(step)}
                          >
                            <Eye className="h-3 w-3" /> Preview
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EmailPreviewModal
        step={previewStep}
        open={!!previewStep}
        onOpenChange={(v) => { if (!v) setPreviewStep(null); }}
        onSave={onSaveStep}
      />
    </>
  );
}
