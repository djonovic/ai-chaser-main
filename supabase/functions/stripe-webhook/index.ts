import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMetaPurchase } from "../_shared/metaCapi.ts";

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = sigHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
  const v1Sig = parts.find((p) => p.startsWith("v1="))?.split("=")[1];
  if (!timestamp || !v1Sig) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSig === v1Sig;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not set");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const payload = await req.text();
    const sigHeader = req.headers.get("stripe-signature") ?? "";

    const isValid = await verifyStripeSignature(payload, sigHeader, webhookSecret);
    if (!isValid) {
      console.error("Invalid Stripe signature");
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(payload);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan ?? null;

        if (userId && plan) {
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);

          await supabase
            .from("profiles")
            .update({
              plan,
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              plan_expires_at: expiresAt.toISOString(),
            })
            .eq("id", userId);

          console.log(`Plan updated: user=${userId} plan=${plan}`);

          const metaEventId = session.metadata?.meta_event_id ??
            `stripe_cs_${session.id}`;
          const amountTotal = session.amount_total as number | null | undefined;
          const value = typeof amountTotal === "number" ? amountTotal / 100 : 0;
          const currency = String(session.currency ?? "usd").toUpperCase();
          const email = session.customer_details?.email ??
            session.customer_email ?? null;
          const appUrl = Deno.env.get("APP_URL") ?? "https://app.chaseai.app";
          await sendMetaPurchase({
            eventId: metaEventId,
            value,
            currency,
            email,
            eventSourceUrl: `${appUrl}/settings`,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        if (subscription.cancel_at_period_end) {
          console.log(`Subscription cancelling at period end: user=${userId}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        await supabase
          .from("profiles")
          .update({
            plan: "free",
            stripe_subscription_id: null,
            plan_expires_at: null,
          })
          .eq("id", userId);

        console.log(`Subscription cancelled, reverted to free: user=${userId}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.error(`Payment failed for customer: ${invoice.customer}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
