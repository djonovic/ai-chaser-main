import { useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient';
import { usePlan } from '@/hooks/usePlan';
import { toast } from 'sonner';
import { Upload, FileText, Sparkles, AlertCircle, CheckCircle2, X, Loader2 } from 'lucide-react';
import type { Client } from '@/types';

interface ExtractedData {
  client_name: string | null;
  client_email: string | null;
  invoice_number: string | null;
  amount: number | null;
  currency: string | null;
  due_date: string | null;
  notes: string | null;
}

interface PdfInvoiceExtractorProps {
  clients: Client[];
  onSave: (data: {
    client_id: string;
    invoice_number: string;
    amount: number;
    currency: string;
    due_date: string;
    notes?: string;
    newClient?: { name: string; email: string };
  }) => Promise<void>;
  onCancel: () => void;
}

type Phase = 'upload' | 'extracting' | 'preview' | 'error';

export function PdfInvoiceExtractor({ clients, onSave, onCancel }: PdfInvoiceExtractorProps) {
  const { userGeminiKey } = usePlan();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Editable extracted fields
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const matchingClient = clients.find(
    (c) =>
      c.name.toLowerCase() === clientName.toLowerCase() ||
      (clientEmail && c.email.toLowerCase() === clientEmail.toLowerCase())
  );

  const resetForm = () => {
    setPhase('upload');
    setFileName('');
    setErrorMessage('');
    setClientName('');
    setClientEmail('');
    setSelectedClientId('');
    setInvoiceNumber('');
    setAmount('');
    setCurrency('USD');
    setDueDate('');
    setNotes('');
  };

  const populateFields = (data: ExtractedData) => {
    if (data.client_name) setClientName(data.client_name);
    if (data.client_email) setClientEmail(data.client_email);
    if (data.invoice_number) setInvoiceNumber(data.invoice_number);
    if (data.amount != null) setAmount(String(data.amount));
    if (data.currency) setCurrency(data.currency);
    if (data.due_date) setDueDate(data.due_date);
    if (data.notes) setNotes(data.notes);

    const match = clients.find(
      (c) =>
        c.name.toLowerCase() === (data.client_name || '').toLowerCase() ||
        (data.client_email && c.email.toLowerCase() === data.client_email.toLowerCase())
    );
    if (match) setSelectedClientId(match.id);
  };

  const extractFromPdf = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setPhase('extracting');
      setErrorMessage('');

      try {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((acc, byte) => acc + String.fromCharCode(byte), '')
        );

        const { data, error } = await supabase.functions.invoke('extract-invoice-pdf', {
          body: { pdfBase64: base64, userApiKey: userGeminiKey || undefined },
        });

        if (data?.error && typeof data.error === 'string') throw new Error(data.error);
        if (error) throw new Error(error.message || 'Extraction failed');
        if (!data?.extracted) throw new Error('No data extracted from PDF');

        populateFields(data.extracted);
        setPhase('preview');
      } catch (err) {
        console.error('PDF extraction error:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to extract data from PDF'
        );
        setPhase('error');
      }
    },
    [userGeminiKey, clients]
  );

  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 20 MB.');
      return;
    }
    extractFromPdf(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFileSelect(e.dataTransfer.files[0]);
    },
    [extractFromPdf]
  );

  const handleSave = async () => {
    const trimmedInvoiceNumber = invoiceNumber.trim();
    const trimmedAmount = amount.trim();
    const trimmedClientName = clientName.trim();
    const trimmedClientEmail = clientEmail.trim();

    if (!trimmedInvoiceNumber || !trimmedAmount || !dueDate) {
      toast.warning('Please fill in invoice number, amount, and due date');
      return;
    }
    const amountValue = parseFloat(trimmedAmount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }
    if (!selectedClientId && !trimmedClientName) {
      toast.warning('Please select an existing client or enter a client name');
      return;
    }
    if (!selectedClientId && trimmedClientEmail) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(trimmedClientEmail)) {
        toast.error('Please enter a valid client email');
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        client_id: selectedClientId,
        invoice_number: trimmedInvoiceNumber,
        amount: amountValue,
        currency,
        due_date: dueDate,
        notes: notes || undefined,
        ...(!selectedClientId && trimmedClientName
          ? { newClient: { name: trimmedClientName, email: trimmedClientEmail || '' } }
          : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  // Upload phase
  if (phase === 'upload') {
    return (
      <div className="space-y-4">
        <div
          className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              Drag & drop your invoice PDF here
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse · PDF up to 20 MB
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
          />
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            AI will extract client name, invoice number, amount, currency, due date, and notes automatically. You can review and edit before saving.
          </p>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Extracting phase
  if (phase === 'extracting') {
    return (
      <div className="space-y-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-medium truncate">{fileName}</span>
          </CardContent>
        </Card>
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-medium">Analyzing PDF with AI...</p>
          </div>
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <p className="text-xs text-muted-foreground">
            Extracting client info, invoice number, amount, and dates...
          </p>
        </div>
      </div>
    );
  }

  // Error phase
  if (phase === 'error') {
    return (
      <div className="space-y-4">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-destructive">Extraction failed</p>
              <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={resetForm}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Preview phase — editable extracted fields
  return (
    <div className="space-y-4">
      <Card className="border-success/30 bg-success/5">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-success">Data extracted from PDF</p>
            <p className="text-xs text-muted-foreground">Review and edit below, then save.</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={resetForm}
            title="Upload different PDF"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {/* Client selection / creation */}
        <div className="space-y-2">
          <Label>Client</Label>
          {matchingClient || selectedClientId ? (
            <div className="flex items-center gap-2">
              <Select value={selectedClientId || matchingClient?.id || ''} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Client name"
                />
                <Input
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="Client email"
                  type="email"
                />
              </div>
              {clientName && (
                <p className="text-xs text-muted-foreground">
                  New client "{clientName}" will be created on save.
                  {clients.length > 0 && (
                    <>
                      {' '}Or{' '}
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setSelectedClientId(clients[0].id)}
                      >
                        pick existing
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Invoice # *</Label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-001"
            />
          </div>
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="RSD">RSD (din.)</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="AUD">AUD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Due Date *</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment terms, bank details..."
            rows={2}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving...</> : 'Save Invoice'}
        </Button>
      </div>
    </div>
  );
}
