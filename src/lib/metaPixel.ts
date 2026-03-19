declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

type FbqStub = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: FbqStub;
  loaded?: boolean;
  version?: string;
};

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

let pixelBootstrapped = false;
let initDone = false;

function bootstrapFbq(): void {
  if (typeof window === "undefined" || pixelBootstrapped) return;
  pixelBootstrapped = true;
  const w = window;
  if (w.fbq) return;

  const fbqFn = function (...args: unknown[]) {
    const self = fbqFn as FbqStub;
    if (self.callMethod) self.callMethod(...args);
    else self.queue.push(args);
  } as FbqStub;
  fbqFn.push = fbqFn;
  fbqFn.loaded = true;
  fbqFn.version = "2.0";
  fbqFn.queue = [];

  const ww = w as Window & { _fbq?: unknown };
  if (!ww._fbq) ww._fbq = fbqFn;
  w.fbq = fbqFn as Window["fbq"];

  const t = document.createElement("script");
  t.async = true;
  t.src = "https://connect.facebook.net/en_US/fbevents.js";
  const s = document.getElementsByTagName("script")[0];
  s?.parentNode?.insertBefore(t, s);
}

export function getMetaPixelId(): string | undefined {
  const id = PIXEL_ID?.trim();
  return id || undefined;
}

/**
 * Loads fbevents.js and runs fbq('init') once. Does not send PageView.
 */
export function ensureMetaPixelInit(): boolean {
  const id = getMetaPixelId();
  if (!id) return false;
  bootstrapFbq();
  if (!initDone && window.fbq) {
    window.fbq("init", id);
    initDone = true;
  }
  return true;
}

export function trackMetaPageView(): void {
  if (!ensureMetaPixelInit()) return;
  window.fbq?.("track", "PageView");
}

export function trackMetaInitiateCheckout(params: {
  value: number;
  currency: string;
  plan: string;
}): void {
  if (!ensureMetaPixelInit()) return;
  window.fbq?.("track", "InitiateCheckout", {
    content_type: "product",
    content_ids: [params.plan],
    value: params.value,
    currency: params.currency,
    num_items: 1,
  });
}

export function trackMetaPurchase(params: {
  eventId: string;
  value: number;
  currency: string;
}): void {
  if (!ensureMetaPixelInit()) return;
  window.fbq?.(
    "track",
    "Purchase",
    {
      value: params.value,
      currency: params.currency,
    },
    { eventID: params.eventId },
  );
}
