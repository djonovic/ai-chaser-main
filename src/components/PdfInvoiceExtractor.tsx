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
import {
  Upload,
  FileText,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  ImageIcon,
  Camera,
} from 'lucide-react';
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

const PDF_MIME = 'application/pdf';
const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

function normalizeMime(file: File): string {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/jpg') return 'image/jpeg';
  if (type) return type;
  // iOS sometimes omits type for HEIC / camera files
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return PDF_MIME;
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic')) return 'image/heic';
  if (name.endsWith('.heif')) return 'image/heif';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return type;
}

function isAllowedFile(file: File): boolean {
  const mime = normalizeMime(file);
  return mime === PDF_MIME || IMAGE_MIMES.has(mime);
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function PdfInvoiceExtractor({ clients, onSave, onCancel }: PdfInvoiceExtractorProps) {
  const { userGeminiKey } = usePlan();
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [sourceKind, setSourceKind] = useState<'pdf' | 'photo'>('pdf');
  const [errorMessage, setErrorMessage] = useState('');

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
    setSourceKind('pdf');
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

  const extractFromFile = useCallback(
    async (file: File) => {
      const mimeType = normalizeMime(file);
      setFileName(file.name || (mimeType.startsWith('image/') ? 'Invoice photo' : 'Invoice PDF'));
      setSourceKind(mimeType.startsWith('image/') ? 'photo' : 'pdf');
      setPhase('extracting');
      setErrorMessage('');

      try {
        const base64 = await fileToBase64(file);

        const { data, error } = await supabase.functions.invoke('extract-invoice-pdf', {
          body: {
            fileBase64: base64,
            pdfBase64: base64,
            mimeType,
            userApiKey: userGeminiKey || undefined,
          },
        });

        if (data?.error && typeof data.error === 'string') throw new Error(data.error);
        if (error) throw new Error(error.message || 'Extraction failed');
        if (!data?.extracted) throw new Error('No data extracted from file');

        populateFields(data.extracted);
        setPhase('preview');
      } catch (err) {
        console.error('Invoice extraction error:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to extract data from file'
        );
        setPhase('error');
      }
    },
    [userGeminiKey, clients]
  );

  const handleFileSelect = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!isAllowedFile(file)) {
        toast.error('Please upload a PDF or photo (JPEG, PNG, WebP, HEIC)');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error('File too large. Maximum size is 20 MB.');
        return;
      }
      void extractFromFile(file);
    },
    [extractFromFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFileSelect(e.dataTransfer.files[0]);
    },
    [handleFileSelect]
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

  if (phase === 'upload') {
    return (
      <div className="space-y-4">
        <div
          className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer ${
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
          onClick={() => pdfInputRef.current?.click()}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Drag & drop a PDF or photo</p>
            <p className="text-xs text-muted-foreground mt-1">
              or choose an option below · up to 20 MB
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3"
            onClick={() => pdfInputRef.current?.click()}
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs font-medium">Upload PDF</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3"
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImageIcon className="h-5 w-5" />
            <span className="text-xs font-medium">Photo library</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="h-5 w-5" />
            <span className="text-xs font-medium">Take photo</span>
          </Button>
        </div>

        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            handleFileSelect(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            handleFileSelect(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {/* capture="environment" opens the rear camera on mobile browsers */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFileSelect(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            AI extracts client name, invoice number, amount, currency, due date, and notes from PDFs or invoice photos. Review and edit before saving.
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

  if (phase === 'extracting') {
    return (
      <div className="space-y-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            {sourceKind === 'photo' ? (
              <ImageIcon className="h-5 w-5 text-primary shrink-0" />
            ) : (
              <FileText className="h-5 w-5 text-primary shrink-0" />
            )}
            <span className="text-sm font-medium truncate">{fileName}</span>
          </CardContent>
        </Card>
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-medium">
              Analyzing {sourceKind === 'photo' ? 'photo' : 'PDF'} with AI...
            </p>
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

  return (
    <div className="space-y-4">
      <Card className="border-success/30 bg-success/5">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-success">
              Data extracted from {sourceKind === 'photo' ? 'photo' : 'PDF'}
            </p>
            <p className="text-xs text-muted-foreground">Review and edit below, then save.</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={resetForm}
            title="Upload a different file"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
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
                  New client &quot;{clientName}&quot; will be created on save.
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
