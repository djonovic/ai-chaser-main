const GRAPH_API_VERSION = "v21.0";

async function sha256HexNormalized(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase();
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type MetaPurchasePayload = {
  eventId: string;
  value: number;
  currency: string;
  email?: string | null;
  eventSourceUrl?: string;
};

/**
 * Sends a server-side Purchase to Meta Conversions API.
 * Skips silently when pixel id or access token is missing.
 */
export async function sendMetaPurchase(
  payload: MetaPurchasePayload,
): Promise<void> {
  const pixelId = Deno.env.get("META_PIXEL_ID")?.trim();
  const accessToken = Deno.env.get("META_CAPI_ACCESS_TOKEN")?.trim();
  if (!pixelId || !accessToken) {
    console.warn("Meta CAPI: META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set");
    return;
  }

  const eventTime = Math.floor(Date.now() / 1000);
  const userData: Record<string, unknown> = {};
  if (payload.email) {
    userData.em = [await sha256HexNormalized(payload.email)];
  }

  const body = {
    data: [
      {
        event_name: "Purchase",
        event_time: eventTime,
        action_source: "website",
        event_source_url: payload.eventSourceUrl ??
          (Deno.env.get("APP_URL") ?? "https://app.chaseai.app") + "/pricing",
        event_id: payload.eventId,
        user_data: userData,
        custom_data: {
          currency: payload.currency,
          value: payload.value,
        },
      },
    ],
  };

  const url =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${
      encodeURIComponent(accessToken)
    }`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Meta CAPI error:", res.status, text);
  }
}
