import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

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

function normalizeTone(tone: unknown): string {
  const t = String(tone ?? "professional").toLowerCase().trim();
  const allowed = ["friendly", "professional", "firm", "humorous"] as const;
  return (allowed as readonly string[]).includes(t) ? t : "professional";
}

function toneVoiceInstructions(tone: string): string {
  switch (tone) {
    case "friendly":
      return "Use warm, conversational language throughout. Even in later steps, stay respectful and assume good intent—no cold or hostile phrasing.";
    case "firm":
      return "Be direct and assertive. Later steps should feel unmistakably serious. Do not apologize for following up; stay factual. Never threaten, harass, or use abusive language.";
    case "humorous":
      return "You may use light, tasteful wit where it fits—especially in early steps. Every email must still be respectful and professional; never mock the client or make light of legal or financial obligations.";
    case "professional":
    default:
      return "Use clear, standard business language—confident, courteous, and concise at every step.";
  }
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

  try {
    return JSON.parse(text);
  } catch {
    const secondPass = text
      .replace(/\\'/g, "'")
      .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
    return JSON.parse(secondPass);
  }
}

function buildPrompt(params: {
  tone: string;
  clientName: string;
  amount: number;
  currency: string;
  daysOverdue: number;
  invoiceNumber: string;
  dueDate: string;
  notes: string;
  senderName: string;
  companyName: string;
  schedule: number[];
  hasPaymentLink: boolean;
}): string {
  const {
    tone: toneRaw,
    clientName,
    amount,
    currency,
    daysOverdue,
    invoiceNumber,
    dueDate,
    notes,
    senderName,
    companyName,
    schedule,
    hasPaymentLink,
  } = params;

  const tone = normalizeTone(toneRaw);
  const voiceBlock = toneVoiceInstructions(tone);

  const stepCount = schedule.length;

  const scheduleLines = schedule
    .map((offset, i) => {
      const overdueAtSend = daysOverdue + offset;
      return `  Step ${i + 1}: day_offset = ${offset}, will be ${overdueAtSend} days overdue when sent`;
    })
    .join("\n");

  const paymentRule = hasPaymentLink
    ? `4. Every email MUST contain this exact call-to-action line on its own paragraph:
   "Please process your payment here: {paymentLink}"`
    : `4. Do NOT mention or reference any payment link or URL in the email body.`;

  const bodyDescription = hasPaymentLink
    ? 'the full email body including {paymentLink} and the signature'
    : 'the full email body including the signature (no payment link)';

  const signatureBlock = senderName && companyName
    ? `${senderName}\\n${companyName}`
    : senderName || companyName;

  return `You are a professional invoice collection copywriter for a SaaS company. Write a ${stepCount}-step email chase sequence for an overdue invoice.

CONTEXT:
- Client name: ${clientName}
- Invoice number: ${invoiceNumber}
- Amount owed: ${amount} ${currency}
- Original due date: ${dueDate}
- Overall tone preference: ${tone}
- Additional context: ${notes || "None"}

VOICE (apply across all steps; combine with the escalation rules below):
${voiceBlock}

EXACT SCHEDULE – each step shows how many days overdue the invoice will be AT THE TIME that email is sent:
${scheduleLines}

CRITICAL: Each email MUST reference the correct number of days overdue for THAT specific step (shown above), NOT the current value. The emails are scheduled for the future, so each one must reflect how overdue the invoice will be when the recipient reads it.

ESCALATION PROGRESSION (mandatory — adapt wording to match the VOICE above):
- Steps 1–2: Lighter reminder. Assume the client may have overlooked the invoice; helpful and clear.
- Steps 3–4: Stronger follow-up. Clearly state the invoice is overdue and request prompt payment. No threats; business-like urgency.
- Steps 5–${stepCount}: Final notice stage. Unmistakably urgent; state this is a final reminder. You may note that unresolved balances may need to be escalated internally—never threaten the recipient personally.

EMAIL RULES (follow every single rule exactly):
1. Each email body MUST be between 80 and 150 words. No more, no less. Keep it concise, scannable, and human-sounding.
2. Steps 1–4: Start with "Hi ${clientName},"
   Steps 5+: Start with "Dear ${clientName},"
3. Every email MUST explicitly mention:
   - The invoice number "${invoiceNumber}"
   - The outstanding amount "${amount} ${currency}"
   - The number of days overdue at send time (from the schedule above)
${paymentRule}
5. Every email MUST end with exactly this signature on its own lines:
   "Best regards,\\n${signatureBlock}"
6. Subject lines: maximum 8 words, MUST include "${invoiceNumber}", and MUST reflect the ${tone} voice.
7. Write like a real person — no archaic phrases like "I trust this finds you well" or "Please be advised". Be direct and natural.
8. Each email must feel distinct. Do NOT repeat the same opening line, structure, or phrasing across steps.
9. Do NOT use bullet points or numbered lists in the email body. Use short paragraphs.

OUTPUT FORMAT:
Return ONLY a raw JSON array. No markdown fences, no backticks, no commentary, no text before or after the array.

Each element is an object with exactly these 4 keys:
- "step_number": integer (1 through ${stepCount})
- "day_offset": integer (use the exact schedule values above)
- "subject": string (short subject line with invoice number)
- "body": string (${bodyDescription})

Example of valid output structure (do NOT copy this content):
[{"step_number":1,"day_offset":${schedule[0]},"subject":"Reminder: Invoice ${invoiceNumber}","body":"Hi ${clientName},\\n\\nWe noticed invoice ${invoiceNumber} for ${amount} ${currency} is still outstanding...\\n\\nPlease process your payment here: {paymentLink}\\n\\nBest regards,\\n${signatureBlock}"}]`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return optionsResponse(req);
  }

  try {
    const authResult = await getAuthenticatedUser(req);
    if ("error" in authResult) {
      return jsonResponse(req, { error: authResult.error }, authResult.status);
    }

    const body = await req.json();
    const {
      tone: toneIn,
      clientName,
      amount,
      currency,
      daysOverdue,
      invoiceNumber,
      dueDate,
      notes,
      senderName,
      companyName,
      hasPaymentLink,
      userApiKey,
    } = body;

    if (!clientName || amount == null || !currency) {
      return jsonResponse(req,
        { error: "Missing required fields: clientName, amount, currency" },
        400,
      );
    }

    const tone = normalizeTone(toneIn);

    const apiKey = userApiKey || Deno.env.get("GEMINI_API_KEY");
    const usingUserKey = !!userApiKey;

    if (!apiKey) {
      return jsonResponse(req, { error: "No Gemini API key configured" }, 500);
    }

    const overdue = typeof daysOverdue === "number" && daysOverdue >= 0 ? daysOverdue : 0;
    const stepCount = overdue > 20 ? 7 : overdue > 7 ? 6 : 5;
    const schedule = computeSchedule(overdue, stepCount);

    const prompt = buildPrompt({
      tone: tone,
      clientName,
      amount,
      currency,
      daysOverdue: overdue,
      invoiceNumber: invoiceNumber || "INV-0000",
      dueDate: dueDate || "N/A",
      notes: notes || "",
      senderName: senderName || "",
      companyName: companyName || "The ChaseAI Team",
      schedule,
      hasPaymentLink: !!hasPaymentLink,
    });

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.45,
          topP: 0.9,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);

      let userMessage: string;

      if (response.status === 429) {
        userMessage = "AI rate limit reached. Please try again in a moment.";
        return jsonResponse(req, { error: userMessage }, 429);
      }

      if (response.status === 403) {
        try {
          const errBody = JSON.parse(errorText);
          const details = errBody?.error?.details as Array<{ reason?: string }> | undefined;
          const isSuspended = details?.some((d) => d?.reason === "CONSUMER_SUSPENDED");
          userMessage = isSuspended
            ? "Your Gemini API key has been suspended by Google. Please create a new key at Google AI Studio or check your Google Cloud account."
            : (errBody?.error?.message as string) || "Access denied. Check your Gemini API key and project settings.";
        } catch {
          userMessage = "Access denied. Your Gemini API key may be invalid or suspended. Try a new key in Settings.";
        }
        return jsonResponse(req, { error: userMessage }, 403);
      }

      if (response.status === 401 || response.status === 400) {
        try {
          const errBody = JSON.parse(errorText);
          const msg = errBody?.error?.message as string | undefined;
          userMessage = msg && typeof msg === "string" ? msg : "Invalid API key. Please check your Gemini key in Settings.";
        } catch {
          userMessage = usingUserKey ? "Invalid API key. Please check your Gemini key in Settings." : "AI generation failed. Please try again.";
        }
        return jsonResponse(req, { error: userMessage }, response.status);
      }

      userMessage = usingUserKey
        ? "Gemini API error. Check your key in Settings or try again later."
        : "AI generation failed. Please try again.";
      return jsonResponse(req, { error: userMessage }, 500);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!rawText) {
      console.error("Empty Gemini response:", JSON.stringify(data));
      return jsonResponse(req,
        { error: "AI returned an empty response. Please try again." },
        500,
      );
    }

    let parsed: unknown[];
    try {
      parsed = sanitizeJsonResponse(rawText);
    } catch (e) {
      console.error("JSON parse failed:", e, "\nRaw:", rawText);
      return jsonResponse(req,
        { error: "Failed to parse AI response. Please try again." },
        500,
      );
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error("AI returned non-array or empty:", rawText);
      return jsonResponse(req,
        { error: "AI returned an invalid response. Please try again." },
        500,
      );
    }

    const invNum = invoiceNumber || "INV-0000";
    // deno-lint-ignore no-explicit-any
    const steps = parsed.map((step: any, i: number) => ({
      step_number: i + 1,
      day_offset: schedule[i] ?? schedule[schedule.length - 1] + (i - schedule.length + 1) * 7,
      subject: typeof step.subject === "string" && step.subject.length > 0
        ? step.subject
        : `Follow-up – Invoice ${invNum}`,
      body: typeof step.body === "string" && step.body.length > 0
        ? step.body
        : "",
    }));

    return jsonResponse(req, { steps, usingUserKey });
  } catch (e) {
    console.error("generate-sequence error:", e);
    return jsonResponse(req,
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});
