import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

const STRIPE_API = "https://api.stripe.com/v1";

async function stripePost(
  secretKey: string,
  endpoint: string,
  params: Record<string, string>,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  const res = await fetch(`${STRIPE_API}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    return { ok: false, error: data?.error?.message ?? "Stripe error" };
  }
  return { ok: true, data };
}

async function stripeGet(
  secretKey: string,
  endpoint: string,
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${STRIPE_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) return null;
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const authResult = await getAuthenticatedUser(req);
    if ("error" in authResult) {
      return jsonResponse(req, { error: authResult.error }, authResult.status);
    }
    const { user } = authResult;

    const { plan, annual } = await req.json();
    if (!plan || !["starter", "pro"].includes(plan)) {
      return jsonResponse(req, { error: "Invalid plan" }, 400);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return jsonResponse(req, { error: "Stripe not configured" }, 500);
    }

    const priceEnvKey = `STRIPE_${plan.toUpperCase()}_${annual ? "ANNUAL" : "MONTHLY"}_PRICE_ID`;
    const priceId = Deno.env.get(priceEnvKey);
    if (!priceId) {
      return jsonResponse(req, { error: `Price not configured: ${priceEnvKey}` }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const result = await stripePost(stripeKey, "/customers", {
        email: user.email!,
        "metadata[supabase_user_id]": user.id,
      });
      if (!result.ok) {
        return jsonResponse(req, { error: result.error! }, 500);
      }
      customerId = result.data!.id as string;

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const existingCustomer = await stripeGet(
      stripeKey,
      `/customers/${customerId}`,
    );
    if (!existingCustomer || (existingCustomer as { deleted?: boolean }).deleted) {
      const result = await stripePost(stripeKey, "/customers", {
        email: user.email!,
        "metadata[supabase_user_id]": user.id,
      });
      if (!result.ok) {
        return jsonResponse(req, { error: result.error! }, 500);
      }
      customerId = result.data!.id as string;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const appUrl = Deno.env.get("APP_URL") ?? "https://app.chaseai.app";
    const session = await stripePost(stripeKey, "/checkout/sessions", {
      customer: customerId,
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${appUrl}/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      "metadata[supabase_user_id]": user.id,
      "metadata[plan]": plan,
      "subscription_data[metadata][supabase_user_id]": user.id,
      "subscription_data[metadata][plan]": plan,
      allow_promotion_codes: "true",
    });

    if (!session.ok) {
      return jsonResponse(req, { error: session.error! }, 500);
    }

    return jsonResponse(req, { url: session.data!.url as string });
  } catch (e) {
    console.error("create-checkout error:", e);
    return jsonResponse(req, { error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
