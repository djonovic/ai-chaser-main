import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { optionsResponse, jsonResponse as corsJson } from "../_shared/cors.ts";

const RESEND_API_URL = "https://api.resend.com/emails";

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

/** Escape HTML for use in email body (open tracking works when HTML is present). */
function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>\n");
}

async function sendEmailViaResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  body: string,
  idempotencyKey: string
): Promise<{ ok: boolean; error?: string; id?: string }> {
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
      text: body,
      html: `<div style="white-space: pre-wrap;">${textToHtml(body)}</div>`,
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
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return corsJson(req, { error: "Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is missing" }, 500);
    }
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token || token !== serviceKey) {
      return corsJson(req, { error: "Unauthorized" }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const fallbackResendKey = Deno.env.get("RESEND_API_KEY");
    const fallbackFrom = Deno.env.get("RESEND_FROM") ?? "ChaseAI <onboarding@resend.dev>";

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: pendingSteps, error: fetchErr } = await supabase
      .from("sequence_steps")
      .select("*, sequences!inner(id, status, current_step, invoice_id, user_id)")
      .eq("status", "pending")
      .eq("sequences.status", "active")
      .lte("send_at", new Date().toISOString())
      .order("send_at", { ascending: true });

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

    const { data: settingsRows } = await supabase
      .from("settings")
      .select("user_id, sender_name, company_name")
      .in("user_id", userIds);

    const settingsByUserId = new Map<string, { sender_name: string | null; company_name: string | null }>();
    for (const row of settingsRows ?? []) {
      settingsByUserId.set(row.user_id, {
        sender_name: row.sender_name ?? null,
        company_name: row.company_name ?? null,
      });
    }

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
    const sequencesToCheck = new Set<string>();

    for (const step of steps) {
      // Claim the step first to avoid duplicates on overlapping runs.
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
        // Another run already claimed/sent it.
        continue;
      }

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

      const userSettings = settingsByUserId.get(seq.user_id);
      const apiKey = fallbackResendKey;
      if (!apiKey) {
        console.error(`No RESEND_API_KEY env configured, skipping step ${step.id}`);
        await supabase
          .from("sequence_steps")
          .update({ status: "pending" })
          .eq("id", step.id)
          .eq("status", "processing");
        continue;
      }

      const senderName = userSettings?.sender_name?.trim();
      const companyName = userSettings?.company_name?.trim();
      const fromName = senderName && companyName
        ? `${senderName}, ${companyName}`
        : senderName || companyName || "ChaseAI";
      const parsedFallback = fallbackFrom.includes("<") ? fallbackFrom.split("<")[1]?.replace(">", "").trim() : fallbackFrom;
      const fromEmail = parsedFallback ?? "onboarding@resend.dev";
      const from = `${fromName} <${fromEmail}>`;

      if (step.channel === "email") {
        const paymentLink = invoiceIdToPaymentLink.get(seq.invoice_id);
        const finalSubject = paymentLink
          ? step.subject.replace(/\{paymentLink\}/g, paymentLink)
          : step.subject;
        const finalBody = paymentLink
          ? step.body.replace(/\{paymentLink\}/g, paymentLink)
          : step.body;

        const idempotencyKey = `sequence-step/${step.id}`;
        const sendResult = await sendEmailViaResend(apiKey, from, toEmail, finalSubject, finalBody, idempotencyKey);
        if (!sendResult.ok) {
          console.error(`Resend failed for step ${step.id}:`, sendResult.error);
          await supabase
            .from("sequence_steps")
            .update({ status: "pending" })
            .eq("id", step.id)
            .eq("status", "processing");
          continue;
        }
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

    return corsJson(req, { message: `Processed ${processed} steps`, processed });
  } catch (e) {
    console.error("process-sequences error:", e);
    return corsJson(req, { error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
