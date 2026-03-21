# Operations & monitoring checklist (ChaseAI)

Use this as a lightweight runbook for trust and uptime—not a substitute for formal incident response if you scale up.

## Daily / weekly

- **Stripe Dashboard**: failed payments, disputes, and webhook delivery (Developers → Webhooks).
- **Supabase**: error rates on Edge Functions (`create-checkout`, `stripe-webhook`, email-related functions), database health, and auth anomalies.
- **Resend** (or your mail provider): bounce rate, spam complaints, and domain/DNS status.

## After deploys

- **App**: sign-in, `/pricing` → Stripe test or small real transaction, return URL with `session_id` (billing tab), confirm plan updates in `profiles`.
- **Marketing**: load `chaseai.app` with devtools → confirm cookie banner appears when `PUBLIC_META_PIXEL_ID` is set; “Essential only” should not load `fbevents.js`.
- **Meta Events Manager**: Test events or production stream for `PageView`, `InitiateCheckout`, `Purchase` (deduped browser + CAPI where configured).

## Incidents

- **Payments broken**: verify `STRIPE_SECRET_KEY`, price IDs, and `stripe-webhook` secret; replay failed webhooks from Stripe if safe.
- **Email not sending**: Resend API key, `RESEND_FROM` domain verification, and function logs.
- **AI errors**: Gemini quota/key, and `generate-sequence` function logs.

## Privacy / compliance reminders

- Marketing Pixel loads only after opt-in (`CookieConsent` + `chaseai_cookie_consent` in localStorage).
- CAPI `Purchase` uses server-side secrets; keep `META_CAPI_ACCESS_TOKEN` out of the frontend.
