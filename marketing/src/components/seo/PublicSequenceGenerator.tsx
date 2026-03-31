import { useMemo, useState } from 'react';

type Tone = 'friendly' | 'professional' | 'firm';

interface Step {
  step_number: number;
  day_offset: number;
  subject: string;
  body: string;
}

interface ResultData {
  extracted?: {
    client_name?: string;
    invoice_number?: string;
    amount?: number;
    currency?: string;
    due_date?: string | null;
  };
  daysOverdue?: number;
  steps: Step[];
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const base64 = content.split(',')[1];
      if (!base64) reject(new Error('Could not read file'));
      else resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function PublicSequenceGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [tone, setTone] = useState<Tone>('professional');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ResultData | null>(null);

  const supabaseUrl =
    (import.meta.env.PUBLIC_SUPABASE_URL as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_URL as string | undefined);
  const supabaseAnonKey =
    (import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string | undefined);
  const envDebug = {
    hasPublicUrl: Boolean(import.meta.env.PUBLIC_SUPABASE_URL),
    hasPublicAnon: Boolean(import.meta.env.PUBLIC_SUPABASE_ANON_KEY),
    hasViteUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
    hasViteAnon: Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY),
  };

  const configError = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return 'Missing Supabase env vars. Set PUBLIC_SUPABASE_URL + PUBLIC_SUPABASE_ANON_KEY (or VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY), then restart the dev server.';
    }
    return '';
  }, [supabaseAnonKey, supabaseUrl]);

  const handleGenerate = async () => {
    setError('');
    if (configError) {
      setError(configError);
      return;
    }
    if (!file) {
      setError('Please upload a PDF invoice first.');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const pdfBase64 = await toBase64(file);
      const response = await fetch(`${supabaseUrl}/functions/v1/public-generate-sequence-from-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey!,
          Authorization: `Bearer ${supabaseAnonKey!}`,
        },
        body: JSON.stringify({ pdfBase64, tone }),
      });

      const data = await response.json();
      if (!response.ok || data?.error) {
        throw new Error(data?.error || 'Failed to generate sequence.');
      }

      setResult(data as ResultData);
      window.dispatchEvent(new CustomEvent('chaseai:sequence_generated'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate sequence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="not-prose rounded-xl border border-border bg-muted/20 p-5">
      <h3 className="text-base font-semibold tracking-tight">Try it free (no account)</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload a PDF, choose tone, and generate a real overdue sequence you can copy right away.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="block mb-1 text-muted-foreground">Invoice PDF</span>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            aria-label="Upload invoice PDF to generate reminder sequence"
            data-track="invoice_upload_start"
            data-cta-id="embedded_pdf_upload"
          />
        </label>
        <label className="text-sm">
          <span className="block mb-1 text-muted-foreground">Tone</span>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
          >
            <option value="friendly">Friendly</option>
            <option value="professional">Professional</option>
            <option value="firm">Firm</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-95 transition-opacity disabled:opacity-60"
          aria-label="Upload invoice PDF to generate reminder sequence"
          data-track="lead_cta_click"
          data-cta-id="embedded_generate"
        >
          {loading ? 'Generating...' : 'Upload invoice PDF'}
        </button>
        <a
          href="https://app.chaseai.app"
          className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
          onClick={() => window.dispatchEvent(new CustomEvent('chaseai:smart_chase_started'))}
          data-track="lead_cta_click"
          data-cta-id="embedded_start_smart_chasing"
        >
          Start Smart Chasing
        </a>
      </div>

      {error && (
        <div className="mt-3 space-y-1">
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-xs text-muted-foreground">
            Env detected: PUBLIC_URL={String(envDebug.hasPublicUrl)} · PUBLIC_ANON={String(envDebug.hasPublicAnon)} ·
            VITE_URL={String(envDebug.hasViteUrl)} · VITE_ANON={String(envDebug.hasViteAnon)}
          </p>
        </div>
      )}

      {result && (
        <div className="mt-5 space-y-3">
          <div className="rounded-lg border border-border bg-background p-3 text-sm">
            <p>
              <strong>Extracted:</strong>{' '}
              {result.extracted?.client_name || 'Client'} · {result.extracted?.invoice_number || 'Invoice'} ·{' '}
              {result.extracted?.amount ?? 0} {result.extracted?.currency || 'USD'} · overdue {result.daysOverdue ?? 0} days
            </p>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {result.steps.map((s) => (
              <div key={s.step_number} className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Step {s.step_number} · Day +{s.day_offset}</p>
                <p className="text-sm font-semibold mt-1">{s.subject}</p>
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
