import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ResendWebhookPayload {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    [key: string]: unknown;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, x-webhook-secret" } });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (webhookSecret) {
      const headerSecret = req.headers.get("x-webhook-secret") ?? req.headers.get("X-Webhook-Secret");
      const url = new URL(req.url);
      const querySecret = url.searchParams.get("secret");
      const provided = headerSecret ?? querySecret;
      if (provided !== webhookSecret) {
        console.error("Resend webhook: invalid or missing secret");
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const payload = (await req.json()) as ResendWebhookPayload;
    if (payload.type !== "email.opened" || !payload.data?.email_id) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const emailId = payload.data.email_id;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: steps, error: findErr } = await supabase
      .from("sequence_steps")
      .select("id")
      .eq("resend_email_id", emailId)
      .in("status", ["sent"])
      .limit(1);

    if (findErr) {
      console.error("Resend webhook: lookup error", findErr);
      return new Response(JSON.stringify({ error: "Lookup failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    if (!steps?.length) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error: updateErr } = await supabase
      .from("sequence_steps")
      .update({ status: "opened" })
      .eq("id", steps[0].id);

    if (updateErr) {
      console.error("Resend webhook: update error", updateErr);
      return new Response(JSON.stringify({ error: "Update failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ received: true, updated: steps[0].id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resend-webhook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
