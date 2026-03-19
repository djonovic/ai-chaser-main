# Meta Pixel + Conversions API (ChaseAI)

This project tracks:

| Location | What runs |
|----------|-----------|
| **Web app** (`VITE_META_PIXEL_ID`) | `PageView` on SPA navigations, `InitiateCheckout` when starting Stripe checkout, browser `Purchase` after successful checkout (return URL). |
| **Marketing site** (`PUBLIC_META_PIXEL_ID`) | Base pixel + `PageView` on each full page load. |
| **Supabase `stripe-webhook`** (`META_PIXEL_ID` + `META_CAPI_ACCESS_TOKEN`) | Server `Purchase` when Stripe sends `checkout.session.completed`. |

Browser and server `Purchase` share the same `event_id` (stored on the Stripe Checkout Session metadata) so Meta can deduplicate them.

---

## What to do in Meta Ads / Events Manager (your existing ad account)

1. **Open [Meta Events Manager](https://business.facebook.com/events_manager2)** (same Business Suite / ad account you already use).

2. **Connect data → Web** (if you don’t already have a pixel for this product).
   - Create or pick a **Dataset** (pixel). Copy the **Pixel ID** (numeric).

3. **Conversions API**
   - In the same dataset: **Settings** → **Conversions API** → generate an **access token** (or use an existing system user token with `ads_management` as Meta documents).
   - Treat this token like a password: **only** in Supabase Edge Function secrets, never in the frontend or Git.

4. **Domains (recommended)**
   - **Settings** → **Domains**: add `app.chaseai.app` and your marketing domain (e.g. `chaseai.app`).
   - Complete **domain verification** (DNS TXT or HTML file) if Meta asks—required for some optimization features.

5. **Aggregated Event Measurement (AEM)** (iOS / browser restrictions)
   - In Events Manager, configure **Aggregated Event Measurement** and set event priority if you use multiple web events for optimization.

6. **Custom conversions / standard events**
   - You can create a **Custom conversion** based on event `Purchase` or use the standard **Purchase** optimization in campaigns once events are firing.
   - In **Test events** (see below), confirm `PageView`, `InitiateCheckout`, and `Purchase`.

7. **Test Events**
   - Events Manager → **Test events** → copy the **test code**.
   - For the **browser**: add `?test_event_code=YOUR_CODE` to the app URL while testing (Meta documents this for the pixel).
   - For **CAPI**: you can append `test_event_code` to the Graph request in development only; the production function here does not send it—use Events Manager’s diagnostics and production traffic after deploy.

8. **Old ad account**
   - Using an old account is fine.
   - Because users land on `chaseai.app` first and then go to `app.chaseai.app`, you should use **one pixel/dataset** for the whole product journey (and just add both domains in Events Manager). If you have multiple unrelated products, then separate datasets are recommended.

---

## Environment variables

### Web app (Vite — e.g. Lovable / Vercel / Netlify env UI)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_META_PIXEL_ID` | For pixel in app | Same numeric Pixel ID as in Events Manager. |

Local: add to `.env` (see root `.env.example`).

### Marketing (Astro)

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_META_PIXEL_ID` | For pixel on marketing pages | Same Pixel ID; `PUBLIC_` exposes it at build time. |

### Supabase Edge Functions (Dashboard → **Project Settings → Edge Functions → Secrets**)

| Secret | Description |
|--------|-------------|
| `META_PIXEL_ID` | Same numeric Pixel ID as `VITE_META_PIXEL_ID`. |
| `META_CAPI_ACCESS_TOKEN` | Conversions API access token from Events Manager. |
| `APP_URL` | Already used for Stripe; should match your app origin (e.g. `https://app.chaseai.app`). |

Redeploy after changing secrets:

```bash
npx supabase functions deploy stripe-webhook
npx supabase functions deploy create-checkout
```

---

## Deploy checklist

- [ ] `VITE_META_PIXEL_ID` set on the app host.
- [ ] `PUBLIC_META_PIXEL_ID` set for marketing builds (if you use the marketing site).
- [ ] `META_PIXEL_ID` + `META_CAPI_ACCESS_TOKEN` set in Supabase; `stripe-webhook` and `create-checkout` deployed.
- [ ] Stripe live/sandbox checkout still works; after a test purchase, see **Purchase** in Events Manager (may take a few minutes).

---

## Privacy / consent

If you serve users in the EU/UK/CH or under strict privacy policies, you may need a **consent** gate before loading `fbevents.js` and before sending CAPI events. This implementation loads the pixel when the ID is set and sends CAPI from the server on successful checkout; adjust to match your legal/consent setup.
