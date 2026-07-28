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

function planFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  const plan = meta?.plan;
  if (plan === "starter" || plan === "pro") return plan;
  return null;
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

    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.session_id === "string" ? body.session_id : null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let plan: string | null = null;
    let customerId: string | null = null;
    let subscriptionId: string | null = null;

    if (sessionId) {
      const session = await stripeGet(stripeKey, `/checkout/sessions/${sessionId}`);
      if (!session) {
        return jsonResponse(req, { error: "Checkout session not found" }, 404);
      }

      const meta = session.metadata as Record<string, unknown> | undefined;
      if (meta?.supabase_user_id && meta.supabase_user_id !== user.id) {
        return jsonResponse(req, { error: "Session does not belong to this user" }, 403);
      }

      const status = session.status as string | undefined;
      if (status && status !== "complete") {
        return jsonResponse(req, { error: "Checkout not completed", status }, 400);
      }

      plan = planFromMetadata(meta);
      customerId = (session.customer as string) ?? null;
      subscriptionId = (session.subscription as string) ?? null;

      if (!plan && subscriptionId) {
        const sub = await stripeGet(stripeKey, `/subscriptions/${subscriptionId}`);
        plan = planFromMetadata(sub?.metadata as Record<string, unknown> | undefined);
      }
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single();

      customerId = profile?.stripe_customer_id ?? null;
      if (!customerId) {
        return jsonResponse(req, { plan: "free", synced: false });
      }

      for (const status of ["trialing", "active"]) {
        const list = await stripeGet(
          stripeKey,
          `/subscriptions?customer=${customerId}&status=${status}&limit=1`,
        );
        const sub = (list as { data?: Record<string, unknown>[] } | null)?.data?.[0];
        if (sub) {
          plan =
            planFromMetadata(sub.metadata as Record<string, unknown> | undefined) ??
            "starter";
          subscriptionId = sub.id as string;
          break;
        }
      }
    }

    if (!plan || !subscriptionId) {
      return jsonResponse(req, { plan: "free", synced: false });
    }

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { error } = await supabase
      .from("profiles")
      .update({
        plan,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        plan_expires_at: expiresAt.toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return jsonResponse(req, { error: error.message }, 500);
    }

    return jsonResponse(req, { plan, synced: true });
  } catch (e) {
    console.error("confirm-checkout error:", e);
    return jsonResponse(
      req,
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});
