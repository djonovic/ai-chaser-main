import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { optionsResponse, jsonResponse } from "../_shared/cors.ts";

const RESEND_API_URL = "https://api.resend.com/emails";

async function sendEmailViaResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: `${res.status}: ${err}` };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return optionsResponse(req);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(req, { error: "Missing or invalid Authorization" }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user?.email) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const { data: settings } = await supabase
      .from("settings")
      .select("sender_name, company_name")
      .eq("user_id", user.id)
      .single();

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return jsonResponse(req,
        { error: "Email sending is not configured. RESEND_API_KEY env is missing on the server." },
        500
      );
    }

    const senderName = settings?.sender_name?.trim();
    const companyName = settings?.company_name?.trim();
    const fromName = senderName && companyName
      ? `${senderName}, ${companyName}`
      : senderName || companyName || "ChaseAI";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    const from = `${fromName} <${fromEmail}>`;

    const subject = "ChaseAI – Test email";
    const text =
      "This is a test email from ChaseAI. Your Resend integration is working and chase emails will be sent from this address.";

    const result = await sendEmailViaResend(
      apiKey,
      from,
      user.email,
      subject,
      text
    );

    if (!result.ok) {
      return jsonResponse(req, { error: result.error ?? "Failed to send email" }, 400);
    }

    return jsonResponse(req, { success: true });
  } catch (e) {
    console.error("send-test-email error:", e);
    return jsonResponse(req,
      { error: e instanceof Error ? e.message : "Unknown error" },
      500
    );
  }
});
