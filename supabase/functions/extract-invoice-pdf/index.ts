import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return optionsResponse(req);
  }

  try {
    const authResult = await getAuthenticatedUser(req);
    if ("error" in authResult) {
      return jsonResponse(req, { error: authResult.error }, authResult.status);
    }

    const { pdfBase64, userApiKey } = await req.json();

    if (!pdfBase64) {
      return jsonResponse(req, { error: "Missing required field: pdfBase64" }, 400);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY") || userApiKey;
    if (!apiKey) {
      return jsonResponse(req, { error: "No Gemini API key configured. Add one in Settings → AI Integration." }, 500);
    }

    const model = "gemini-2.5-flash";

    const prompt = `You are an invoice data extraction assistant. Analyze this PDF invoice and extract the following fields.

Return ONLY a valid JSON object (no markdown, no explanation) with these keys:
- client_name (string, the customer/client name on the invoice)
- client_email (string or null, the client email if visible)
- invoice_number (string, the invoice number/ID)
- amount (number, the total amount due — use the final total, not subtotals)
- currency (string, 3-letter ISO code like "USD", "EUR", "GBP", "RSD". Infer from symbols: $ = USD, € = EUR, £ = GBP, din. or RSD = RSD)
- due_date (string in YYYY-MM-DD format, or null if not visible)
- notes (string or null, any payment terms, bank details, or special notes)

If a field is not visible, set it to null. For amount, always return a number (no commas or currency symbols).

Example: {"client_name":"Acme Corp","client_email":"billing@acme.com","invoice_number":"INV-2024-042","amount":1500.00,"currency":"USD","due_date":"2024-03-15","notes":"Net 30 payment terms"}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);

      if (response.status === 429) {
        return jsonResponse(req, { error: "AI rate limit reached. Please try again in a moment." }, 429);
      }

      return jsonResponse(req, {
        error: userApiKey
          ? "Invalid API key or Gemini error. Check your key in Settings."
          : "AI extraction failed. Please try again.",
      }, 500);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse AI extraction response:", text);
      return jsonResponse(req, { error: "AI could not extract data from this PDF. Try a clearer invoice." }, 500);
    }

    const extracted = JSON.parse(jsonMatch[0]);

    if (typeof extracted.amount === "string") {
      extracted.amount = parseFloat(extracted.amount.replace(/[^0-9.-]/g, "")) || null;
    }

    return jsonResponse(req, { extracted });
  } catch (e) {
    console.error("extract-invoice-pdf error:", e);
    return jsonResponse(req, { error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
