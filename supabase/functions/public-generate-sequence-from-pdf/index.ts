import { optionsResponse, jsonResponse } from "../_shared/cors.ts";

type Tone = "friendly" | "professional" | "firm" | "humorous";

function normalizeTone(tone: unknown): Tone {
  const value = String(tone ?? "professional").toLowerCase().trim();
  if (value === "friendly" || value === "firm" || value === "humorous") return value;
  return "professional";
}

function computeSchedule(daysOverdue: number, stepCount: number): number[] {
  let firstOffset: number;
  let gaps: number[];

  if (daysOverdue <= 7) {
    firstOffset = 2;
    gaps = [5, 10, 18, 28, 40, 55];
  } else if (daysOverdue <= 20) {
    firstOffset = 1;
    gaps = [4, 8, 14, 22, 30, 40];
  } else {
    firstOffset = 0;
    gaps = [4, 8, 14, 22, 30, 40];
  }

  const offsets: number[] = [firstOffset];
  for (let i = 0; i < stepCount - 1; i++) {
    offsets.push(firstOffset + gaps[Math.min(i, gaps.length - 1)]);
  }
  return offsets;
}

function sanitizeJsonResponse(raw: string): unknown[] {
  let text = raw
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    text = arrayMatch[0];
  }

  text = text
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .replace(/,\s*([}\]])/g, "$1");

  return JSON.parse(text);
}

async function extractInvoiceData(apiKey: string, pdfBase64: string) {
  const prompt = `You are an invoice data extraction assistant. Analyze this PDF invoice and extract the following fields.

Return ONLY a valid JSON object (no markdown, no explanation) with these keys:
- client_name (string, the customer/client name on the invoice)
- client_email (string or null, the client email if visible)
- invoice_number (string, the invoice number/ID)
- amount (number, the total amount due)
- currency (string, 3-letter ISO code like "USD", "EUR", "GBP")
- due_date (string in YYYY-MM-DD format, or null if not visible)
- notes (string or null, any payment terms or special notes)

If a field is not visible, set it to null.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: "application/pdf",
                  data: pdfBase64,
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1 },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Extraction failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse invoice PDF");

  const extracted = JSON.parse(jsonMatch[0]);
  if (typeof extracted.amount === "string") {
    extracted.amount = parseFloat(extracted.amount.replace(/[^0-9.-]/g, "")) || 0;
  }
  return extracted;
}

function buildPrompt(params: {
  tone: Tone;
  clientName: string;
  amount: number;
  currency: string;
  daysOverdue: number;
  invoiceNumber: string;
  dueDate: string;
  notes: string;
  schedule: number[];
}): string {
  const {
    tone,
    clientName,
    amount,
    currency,
    daysOverdue,
    invoiceNumber,
    dueDate,
    notes,
    schedule,
  } = params;

  const scheduleLines = schedule
    .map((offset, i) => `Step ${i + 1}: day_offset=${offset}, overdue_at_send=${daysOverdue + offset}`)
    .join("\n");

  return `Write a ${schedule.length}-step overdue invoice email sequence in ${tone} tone.

Context:
- Client: ${clientName}
- Invoice: ${invoiceNumber}
- Amount: ${amount} ${currency}
- Due date: ${dueDate}
- Notes: ${notes || "None"}

Schedule:
${scheduleLines}

Rules:
- Each subject max 8 words and includes invoice number.
- Each body 80-140 words.
- Mention amount, invoice number, overdue days for that step.
- Keep progression: friendly -> firm.
- Return JSON array only.

Schema:
[{"step_number":1,"day_offset":0,"subject":"...","body":"..."}]`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const { pdfBase64, tone } = await req.json();
    if (!pdfBase64) return jsonResponse(req, { error: "Missing pdfBase64" }, 400);

    // Rough payload guard (about 8 MB PDF max after base64 overhead).
    if (typeof pdfBase64 !== "string" || pdfBase64.length > 11_000_000) {
      return jsonResponse(req, { error: "PDF too large. Please upload a smaller file." }, 400);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return jsonResponse(req, { error: "Missing GEMINI_API_KEY" }, 500);

    const extracted = await extractInvoiceData(apiKey, pdfBase64);
    const dueDate = extracted?.due_date ? new Date(extracted.due_date) : null;
    const now = new Date();
    const daysOverdue = dueDate ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000)) : 0;

    const stepCount = daysOverdue > 20 ? 7 : daysOverdue > 7 ? 6 : 5;
    const schedule = computeSchedule(daysOverdue, stepCount);

    const prompt = buildPrompt({
      tone: normalizeTone(tone),
      clientName: extracted?.client_name || "Client",
      amount: Number(extracted?.amount || 0),
      currency: extracted?.currency || "USD",
      daysOverdue,
      invoiceNumber: extracted?.invoice_number || "INV-0000",
      dueDate: extracted?.due_date || "N/A",
      notes: extracted?.notes || "",
      schedule,
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.45, topP: 0.9 },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse(req, { error: `Sequence generation failed: ${errorText}` }, 500);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!rawText) return jsonResponse(req, { error: "Empty AI response" }, 500);

    const parsed = sanitizeJsonResponse(rawText);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return jsonResponse(req, { error: "Invalid AI output format" }, 500);
    }

    // deno-lint-ignore no-explicit-any
    const steps = parsed.map((step: any, i: number) => ({
      step_number: i + 1,
      day_offset: typeof step.day_offset === "number" ? step.day_offset : schedule[i] ?? i * 7,
      subject: typeof step.subject === "string" && step.subject ? step.subject : `Follow-up – Invoice ${extracted?.invoice_number || "INV-0000"}`,
      body: typeof step.body === "string" ? step.body : "",
    }));

    return jsonResponse(req, {
      extracted,
      daysOverdue,
      steps,
    });
  } catch (e) {
    return jsonResponse(req, { error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
