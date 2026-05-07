# Operations & monitoring checklist (ChaseAI)

Use this as a lightweight runbook for trust and uptime—not a substitute for formal incident response if you scale up.

## Daily / weekly

- **Stripe Dashboard**: failed payments, disputes, and webhook delivery (Developers → Webhooks).
- **Supabase**: error rates on Edge Functions (`create-checkout`, `stripe-webhook`, email-related functions), database health, and auth anomalies.
- **Resend** (or your mail provider): bounce rate, spam complaints, and domain/DNS status.

## After deploys

- **App**: sign-in, `/pricing` → Stripe test or small real transaction, return URL with `session_id` (billing tab), confirm plan updates in `profiles`.
- **Marketing**: load `chaseai.app`, verify page rendering, forms, and key CTAs.

## Incidents

- **Payments broken**: verify `STRIPE_SECRET_KEY`, price IDs, and `stripe-webhook` secret; replay failed webhooks from Stripe if safe.
- **Email not sending**: Resend API key, `RESEND_FROM` domain verification, and function logs.
- **AI errors**: Gemini quota/key, and `generate-sequence` function logs.

## Privacy / compliance reminders

- Review your `cookies` and `privacy` pages whenever third-party tracking/analytics setup changes.
