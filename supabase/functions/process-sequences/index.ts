import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { optionsResponse, jsonResponse as corsJson } from "../_shared/cors.ts";

const RESEND_API_URL = "https://api.resend.com/emails";
const MAX_STEPS_PER_RUN = 50;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeEmailText(text: string): string {
  // Normalize newlines and avoid accidental huge vertical gaps in emails.
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

interface SequenceRow {
  id: string;
  status: string;
  current_step: number;
  invoice_id: string;
  user_id: string;
}

interface PendingStepRow {
  id: string;
  sequence_id: string;
  step_number: number;
  subject: string;
  body: string;
  channel: string;
  send_at: string;
  sequences: SequenceRow;
}

function userDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const candidates = [
    meta.full_name,
    meta.name,
    meta.display_name,
    meta.first_name && meta.last_name ? `${meta.first_name} ${meta.last_name}` : undefined,
  ]
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter(Boolean);

  if (candidates.length > 0) return candidates[0];
  const email = user?.email?.trim();
  if (email) return email.split("@")[0] || "ChaseAI";
  return "ChaseAI";
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice("bearer ".length).trim() || null;
}

function authDiagnostics(req: Request): {
  mode: "secret" | "bearer";
  secretConfigured: boolean;
  secretHeaderPresent: boolean;
  bearerPresent: boolean;
} {
  const secret = Deno.env.get("PROCESS_SEQUENCES_SECRET")?.trim();
  const provided = req.headers.get("X-Process-Sequences-Secret")?.trim();
  const token = bearerToken(req);
  return {
    mode: secret ? "secret" : "bearer",
    secretConfigured: !!secret,
    secretHeaderPresent: !!provided,
    bearerPresent: !!token,
  };
}

function isAuthorized(req: Request, serviceRoleKey: string): boolean {
  const secret = Deno.env.get("PROCESS_SEQUENCES_SECRET")?.trim();
  if (secret) {
    const provided = req.headers.get("X-Process-Sequences-Secret")?.trim();
    return !!provided && provided === secret;
  }
  const token = bearerToken(req);
  return !!token && token === serviceRoleKey;
}

async function sendEmailViaResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  body: string,
  idempotencyKey: string
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const normalizedBody = normalizeEmailText(body);
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      "User-Agent": "ChaseAI-Process-Sequences/1.0",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: normalizedBody,
      html: `<div style="white-space: pre-wrap;">${escapeHtml(normalizedBody)}</div>`,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: `${res.status}: ${err}` };
  }
  try {
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch {
    return { ok: true };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return optionsResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return corsJson(
        req,
        { error: "Server misconfigured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing" },
        500,
      );
    }

    if (!isAuthorized(req, serviceRoleKey)) {
      return corsJson(
        req,
        {
          error: "Unauthorized",
          ...authDiagnostics(req),
        },
        401,
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim();
    if (!resendApiKey) {
      return corsJson(req, { error: "Server misconfigured: RESEND_API_KEY is missing" }, 500);
    }

    // Match send-test-email behavior.
    const fromEmailEnv = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "onboarding@resend.dev";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: pendingSteps, error: fetchErr } = await supabase
      .from("sequence_steps")
      .select("*, sequences!inner(id, status, current_step, invoice_id, user_id)")
      .eq("status", "pending")
      .eq("sequences.status", "active")
      .lte("send_at", new Date().toISOString())
      .order("send_at", { ascending: true })
      .limit(MAX_STEPS_PER_RUN);

    if (fetchErr) {
      console.error("Error fetching pending steps:", fetchErr);
      return corsJson(req, { error: "Failed to fetch pending steps" }, 500);
    }

    const steps = (pendingSteps ?? []) as PendingStepRow[];

    if (steps.length === 0) {
      return corsJson(req, { message: "No pending steps to process", processed: 0 });
    }

    const userIds = [...new Set(steps.map((s) => s.sequences.user_id))];
    const invoiceIds = [...new Set(steps.map((s) => s.sequences.invoice_id))];

    // Build "From" name strictly from the user's own name (auth metadata), not settings/company.
    const userNameByUserId = new Map<string, string>();
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const { data, error } = await supabase.auth.admin.getUserById(userId);
          if (error) throw error;
          userNameByUserId.set(userId, userDisplayName(data.user));
        } catch (e) {
          console.error(`Failed to resolve user name for ${userId}:`, e);
          userNameByUserId.set(userId, "ChaseAI");
        }
      }),
    );

    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, client_id, payment_link")
      .in("id", invoiceIds);

    const clientIds = [...new Set((invoices ?? []).map((i) => i.client_id))];
    const { data: clients } = await supabase
      .from("clients")
      .select("id, email")
      .in("id", clientIds);

    const clientEmailById = new Map<string, string>();
    for (const c of clients ?? []) {
      clientEmailById.set(c.id, c.email);
    }

    const invoiceIdToClientEmail = new Map<string, string>();
    const invoiceIdToPaymentLink = new Map<string, string>();

    for (const inv of invoices ?? []) {
      const email = clientEmailById.get(inv.client_id);
      if (email) invoiceIdToClientEmail.set(inv.id, email);
      if (inv.payment_link) {
        invoiceIdToPaymentLink.set(inv.id, inv.payment_link);
      }
    }

    let processed = 0;
    let claimedCount = 0;
    let sentCount = 0;
    const sequencesToCheck = new Set<string>();

    for (const step of steps) {
      // Claim first to avoid duplicates across overlapping runs.
      const nowIso = new Date().toISOString();
      const { data: claimed, error: claimErr } = await supabase
        .from("sequence_steps")
        .update({ status: "processing" })
        .eq("id", step.id)
        .eq("status", "pending")
        .select("id");

      if (claimErr) {
        console.error(`Error claiming step ${step.id}:`, claimErr);
        continue;
      }
      if (!claimed || claimed.length === 0) {
        continue;
      }
      claimedCount++;

      const seq = step.sequences;
      const toEmail = invoiceIdToClientEmail.get(seq.invoice_id);
      if (!toEmail) {
        console.error(`No client email for invoice ${seq.invoice_id}, skipping step ${step.id}`);
        await supabase
          .from("sequence_steps")
          .update({ status: "pending" })
          .eq("id", step.id)
          .eq("status", "processing");
        continue;
      }

      const fromName = userNameByUserId.get(seq.user_id) || "ChaseAI";
      const from = `${fromName} <${fromEmailEnv}>`;

      if (step.channel === "email") {
        const paymentLink = invoiceIdToPaymentLink.get(seq.invoice_id);
        const finalSubject = paymentLink
          ? step.subject.replace(/\{paymentLink\}/g, paymentLink)
          : step.subject
            .replace(/^.*\{paymentLink\}.*\n?/gim, "")
            .replace(/\{paymentLink\}/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        const finalBody = paymentLink
          ? step.body.replace(/\{paymentLink\}/g, paymentLink)
          : step.body
            .replace(/^.*\{paymentLink\}.*\n?/gim, "")
            .replace(/\{paymentLink\}/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        const idempotencyKey = `sequence-step/${step.id}`;
        const sendResult = await sendEmailViaResend(
          resendApiKey,
          from,
          toEmail,
          finalSubject,
          finalBody,
          idempotencyKey,
        );
        if (!sendResult.ok) {
          console.error(`Resend failed for step ${step.id}:`, sendResult.error);
          await supabase
            .from("sequence_steps")
            .update({ status: "pending" })
            .eq("id", step.id)
            .eq("status", "processing");
          continue;
        }
        sentCount++;
        const updatePayload: { status: string; sent_at: string; resend_email_id?: string } = {
          status: "sent",
          sent_at: nowIso,
        };
        if (sendResult.id) updatePayload.resend_email_id = sendResult.id;
        const { error: updateStepErr } = await supabase
          .from("sequence_steps")
          .update(updatePayload)
          .eq("id", step.id);
        if (updateStepErr) {
          console.error(`Error updating step ${step.id}:`, updateStepErr);
          continue;
        }
      } else {
        const { error: updateStepErr } = await supabase
          .from("sequence_steps")
          .update({ status: "sent", sent_at: nowIso })
          .eq("id", step.id);
        if (updateStepErr) {
          console.error(`Error updating step ${step.id}:`, updateStepErr);
          continue;
        }
      }

      const { error: updateSeqErr } = await supabase
        .from("sequences")
        .update({ current_step: step.step_number })
        .eq("id", step.sequence_id);

      if (updateSeqErr) {
        console.error(`Error updating sequence ${step.sequence_id}:`, updateSeqErr);
      }

      sequencesToCheck.add(step.sequence_id);
      processed++;
    }

    for (const seqId of sequencesToCheck) {
      const { data: remainingSteps } = await supabase
        .from("sequence_steps")
        .select("id")
        .eq("sequence_id", seqId)
        .in("status", ["pending", "processing"]);

      if (!remainingSteps || remainingSteps.length === 0) {
        await supabase
          .from("sequences")
          .update({ status: "completed" })
          .eq("id", seqId);
        console.log(`Sequence ${seqId} completed - all steps sent`);
      }
    }

    return corsJson(req, {
      message: `Processed ${processed} steps`,
      processed,
      claimed: claimedCount,
      sent: sentCount,
      scanned: steps.length,
    });
  } catch (e) {
    console.error("process-sequences error:", e);
    return corsJson(req, { error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
