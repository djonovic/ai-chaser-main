import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { User } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_API = "https://api.stripe.com/v1";

const allowedOriginsRaw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
const ALLOWED_ORIGINS = allowedOriginsRaw
  ? allowedOriginsRaw.split(",").map((o) => o.trim())
  : [];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const isAllowed =
    ALLOWED_ORIGINS.length === 0 ||
    ALLOWED_ORIGINS.includes(origin) ||
    origin.startsWith("http://localhost");

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0] ?? "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function optionsResponse(req: Request): Response {
  return new Response(null, { status: 204, headers: getCorsHeaders(req) });
}

function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function getAuthenticatedUser(
  req: Request,
): Promise<{ user: User; token: string } | { error: string; status: number }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: "Unauthorized", status: 401 };
  }

  return { user, token };
}

async function stripeRequest(
  secretKey: string,
  method: "GET" | "DELETE" | "POST",
  endpoint: string,
  params?: Record<string, string>,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  const res = await fetch(`${STRIPE_API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(params
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    return { ok: false, error: data?.error?.message ?? "Stripe error" };
  }
  return { ok: true, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const authResult = await getAuthenticatedUser(req);
    if ("error" in authResult) {
      return jsonResponse(req, { error: authResult.error }, authResult.status);
    }
    const { user } = authResult;

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return jsonResponse(req, { error: "Stripe not configured" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, stripe_subscription_id, plan")
      .eq("id", user.id)
      .single();

    let subscriptionId = profile?.stripe_subscription_id as string | null;

    // Fallback: find trialing/active sub on the Stripe customer.
    if (!subscriptionId && profile?.stripe_customer_id) {
      for (const status of ["trialing", "active", "past_due"]) {
        const list = await stripeRequest(
          stripeKey,
          "GET",
          `/subscriptions?customer=${profile.stripe_customer_id}&status=${status}&limit=1`,
        );
        const sub = (list.data as { data?: { id: string }[] } | undefined)?.data?.[0];
        if (sub?.id) {
          subscriptionId = sub.id;
          break;
        }
      }
    }

    if (subscriptionId) {
      // Immediate cancel so trials never convert to a charge.
      const canceled = await stripeRequest(
        stripeKey,
        "DELETE",
        `/subscriptions/${subscriptionId}`,
      );
      if (!canceled.ok) {
        return jsonResponse(req, { error: canceled.error! }, 500);
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        plan: "free",
        stripe_subscription_id: null,
        plan_expires_at: null,
      })
      .eq("id", user.id);

    if (error) {
      return jsonResponse(req, { error: error.message }, 500);
    }

    return jsonResponse(req, {
      canceled: true,
      stripe_canceled: !!subscriptionId,
      plan: "free",
    });
  } catch (e) {
    console.error("cancel-subscription error:", e);
    return jsonResponse(
      req,
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});
