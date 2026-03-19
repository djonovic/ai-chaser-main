# ChaseAI Integrations – Setup Guide

This document covers SQL to run, terminal commands, new files/functions, and Supabase configuration for Stripe, QuickBooks/Xero, and Gmail.

---

## 1. SQL to run in Supabase

Apply the migration (or run its contents in **Supabase Dashboard → SQL Editor**):

- **File:** `supabase/migrations/20250309140000_integrations_stripe_gmail.sql`
- **File:** `supabase/migrations/20250309150000_stripe_connect.sql` (Stripe Connect one-click OAuth)

They add:

- `invoices.paid_via` (manual | stripe | quickbooks | xero)
- `settings.stripe_publishable_key`
- `sequence_steps` status `'cancelled'`
- `accounting_connections` (QuickBooks/Xero OAuth)
- `gmail_connections` (Gmail OAuth)
- `stripe_connections` (Stripe Connect: user_id, stripe_account_id, stripe_publishable_key)
- `sequences.paused_reason`
- Index `idx_invoices_invoice_number` on `(user_id, invoice_number)`

No extra RLS policies are required for the Edge Functions; they use the **service role** key, which bypasses RLS.

---

## 2. New files and Edge Functions

### New / updated app files

| Path | Purpose |
|------|--------|
| `src/hooks/useAccountingConnections.ts` | QuickBooks/Xero connection state and disconnect |
| `src/hooks/useGmailConnection.ts` | Gmail connection state and disconnect |
| `src/hooks/useSettings.ts` | Extended with Stripe keys (legacy); Stripe now uses Connect |
| `src/hooks/useStripeConnection.ts` | Stripe Connect connection state and disconnect |
| `src/hooks/useInvoices.ts` | `paid_via`, realtime toast for Stripe auto-paid, `fetchInvoices` returns list |
| `src/hooks/useSequences.ts` | `cancelPendingStepsForSequence`, `paused_reason`, `skipToast` on status update |
| `src/pages/SettingsPage.tsx` | Stripe Connect (one-click), QuickBooks/Xero/Gmail connect and OAuth callback toasts |
| `src/pages/InvoiceDetailPage.tsx` | Manual “Mark as Paid” sets `paid_via: 'manual'`, cancel pending steps, “Client replied – sequence paused” |
| `src/types/index.ts` | `PaidVia`, `StepStatus` + `cancelled`, `Sequence.paused_reason`, Settings Stripe keys |

### New Edge Functions

| Function | Role |
|----------|------|
| `stripe-webhook` | Stripe webhook: `invoice.payment_succeeded`, `payment_intent.succeeded`, `checkout.session.completed` → resolve user from Connect `event.account` or metadata → mark invoice paid, complete sequence, cancel pending steps |
| `stripe-connect-auth` | Returns Stripe Connect OAuth URL (Bearer required); one-click “Connect with Stripe” |
| `stripe-connect-callback` | Exchanges code, stores `stripe_account_id` (and optional publishable key) in `stripe_connections`, redirects to app |
| `quickbooks-auth` | Returns QuickBooks OAuth URL (Bearer required) |
| `quickbooks-callback` | Exchanges code, stores tokens in `accounting_connections`, redirects to app |
| `xero-auth` | Returns Xero OAuth URL (Bearer required) |
| `xero-callback` | Exchanges code, stores tokens in `accounting_connections`, redirects to app |
| `gmail-auth` | Returns Gmail OAuth URL (Bearer required) |
| `gmail-callback` | Exchanges code, stores tokens in `gmail_connections`, redirects to app |
| `sync-accounting` | Cron: refresh tokens, fetch paid invoices from QB/Xero, match by `invoice_number`, mark paid (Starter/Pro only) |
| `check-gmail-replies` | Cron: refresh tokens, recent Gmail messages, keyword + client email match → pause sequence, set `paused_reason: 'replied'` (Starter/Pro only) |
| `resend-webhook` | Resend webhook: on `email.opened`, finds `sequence_steps` by `resend_email_id` and sets status to `opened` so users can see when emails are opened. |

---

## 3. Terminal commands to test

```bash
# Install deps (if needed)
npm install

# Run app
npm run dev

# Run migrations (if using Supabase CLI)
npx supabase db push

# Deploy all Edge Functions
npx supabase functions deploy stripe-webhook
npx supabase functions deploy stripe-connect-auth
npx supabase functions deploy stripe-connect-callback
npx supabase functions deploy quickbooks-auth
npx supabase functions deploy quickbooks-callback
npx supabase functions deploy xero-auth
npx supabase functions deploy xero-callback
npx supabase functions deploy gmail-auth
npx supabase functions deploy gmail-callback
npx supabase functions deploy sync-accounting
npx supabase functions deploy check-gmail-replies
npx supabase functions deploy resend-webhook

# Or deploy everything
npx supabase functions deploy
```

Test Stripe webhook locally (after setting secrets):

```bash
stripe listen --forward-to https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook
# Then trigger a test event, e.g. payment_intent.succeeded with metadata invoice_id or invoice_number + user_id
```

---

## 4. Supabase configuration

### 4.1 Edge Function secrets

In **Supabase Dashboard → Project Settings → Edge Functions** (or via CLI), set:

**Stripe (platform account + Connect):**

- `STRIPE_WEBHOOK_SECRET` – Webhook signing secret from Stripe Dashboard (platform webhook).
- `STRIPE_SECRET_KEY` – Platform secret key (verifies webhook; used in Connect OAuth token exchange).
- `STRIPE_CONNECT_CLIENT_ID` – Connect OAuth client id (from [Stripe Connect settings](https://dashboard.stripe.com/settings/connect/onboarding-options/oauth), e.g. `ca_xxx`). Required for “Connect with Stripe” one-click flow.

**QuickBooks:**

- `QUICKBOOKS_CLIENT_ID`
- `QUICKBOOKS_CLIENT_SECRET`

**Xero:**

- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`

**Gmail:**

- `GMAIL_OAUTH_CLIENT_ID`
- `GMAIL_OAUTH_CLIENT_SECRET`

**App URL (for OAuth redirects):**

- `SITE_URL` – e.g. `https://your-app.com` or `http://localhost:5173` for dev.

### 4.2 Stripe webhook and Connect

1. In **Stripe Dashboard → Developers → Webhooks**, add endpoint:
   - **URL:** `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`
   - **Events:** `invoice.payment_succeeded`, `payment_intent.succeeded`, `checkout.session.completed`
   - Enable **Listen to events on Connected accounts** if you use Stripe Connect so events from connected accounts include the `account` field.
2. Copy the **Signing secret** and set it as `STRIPE_WEBHOOK_SECRET` in Supabase.

3. **Stripe Connect (one-click connect):** In **Stripe Dashboard → Connect settings → OAuth**, add redirect URI:
   - `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/stripe-connect-callback`
   Copy the **Client ID** (e.g. `ca_xxx`) and set it as `STRIPE_CONNECT_CLIENT_ID` in Supabase.

When creating Stripe Checkout/Invoices/Payment Intents (on behalf of a connected account or platform), send metadata so the webhook can find the ChaseAI invoice:

- `metadata.invoice_id` – ChaseAI invoice UUID, or
- `metadata.invoice_number` + `metadata.user_id` (or `chaseai_invoice_id` / `chaseai_user_id`).

For **Connect** payments, the webhook resolves the user from `event.account` → `stripe_connections.stripe_account_id` → `user_id`, so metadata can omit `user_id` if the event is for a connected account.

### 4.3 Resend open tracking (optional)

Users can see when chase emails are **opened** in the app. This uses Resend’s open-tracking and webhooks.

1. **Enable open tracking in Resend**  
   In [Resend Dashboard → Domains](https://resend.com/domains), select your sending domain and enable **Open tracking** in the domain configuration.

2. **Run the migration** that adds `resend_email_id` to `sequence_steps`:
   - **File:** `supabase/migrations/20260317000000_sequence_steps_resend_email_id.sql`

3. **Deploy the webhook function** and register it in Resend:
   ```bash
   npx supabase functions deploy resend-webhook
   ```
   In [Resend → Webhooks](https://resend.com/webhooks), add a webhook:
   - **URL:** `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/resend-webhook`  
     If you set `RESEND_WEBHOOK_SECRET` in Supabase, append `?secret=<same_value>` to the URL, or send it as header `X-Webhook-Secret`.
   - **Events:** select **email.opened**.

4. **Secrets (optional):**  
   Set `RESEND_WEBHOOK_SECRET` in Supabase Edge Function secrets if you want to verify webhook requests (then use the same value in the Resend webhook URL as `?secret=...` or in a custom header).

The app already sends HTML and stores Resend’s email `id` on each step when sending. When a recipient opens the email, Resend calls your webhook; the function finds the step by `resend_email_id` and sets its status to `opened`, so the UI shows “Opened” for that step.

### 4.4 Cron jobs (sync-accounting and check-gmail-replies)

In **Supabase Dashboard → Database → Extensions** ensure `pg_cron` is enabled. Then in **SQL Editor** run:

```sql
-- Run sync-accounting every 6 hours
select cron.schedule(
  'sync-accounting',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/sync-accounting',
    headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Run check-gmail-replies every 15 minutes
select cron.schedule(
  'check-gmail-replies',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/check-gmail-replies',
    headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

Replace `<YOUR_PROJECT_REF>` and `<YOUR_SERVICE_ROLE_KEY>` with your project reference and service role key. If `pg_cron` / `net.http_post` are not available, use an external cron (e.g. GitHub Actions or a cron server) to POST to these function URLs with the same `Authorization: Bearer <SERVICE_ROLE_KEY>` header.

### 4.5 OAuth redirect URIs

**QuickBooks (Intuit):**

curl -L -X POST 'https://pxuxwpmzhtuyrfrwfeae.supabase.co/functions/v1/process-sequences' \
  -H 'Authorization: Bearer sb_publishable_5xbwfOVUhXPvRr3O92_gyg_r70tjAda' \
  -H 'apikey: sb_publishable_5xbwfOVUhXPvRr3O92_gyg_r70tjAda' \
  -H 'Content-Type: application/json' \
  --data '{"name":"Functions"}'

- Redirect URI: `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/quickbooks-callback`
- Add this in the [Intuit Developer](https://developer.intuit.com) app settings.

**Xero:**

- Redirect URI: `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/xero-callback`
- Add in [Xero Developer](https://developer.xero.com/app/manage) app settings.

**Google (Gmail):**

- Redirect URI: `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/gmail-callback`
- Add in [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs.
- Enable **Gmail API** for the project.

---

## 5. Plan and quotas

- **Stripe:** All plans; webhook runs for any user’s invoice when Stripe metadata matches.
- **QuickBooks / Xero:** Only **Starter** and **Pro**; `sync-accounting` skips users on Free plan.
- **Gmail:** Only **Starter** and **Pro**; `check-gmail-replies` skips users on Free plan.

---

## 6. Meta Pixel + Conversions API

See **[META_PIXEL_AND_CAPI.md](./META_PIXEL_AND_CAPI.md)** for Events Manager setup, env vars (`VITE_META_PIXEL_ID`, `PUBLIC_META_PIXEL_ID` for marketing, Supabase secrets `META_PIXEL_ID` + `META_CAPI_ACCESS_TOKEN`), and deploy notes.

---

## 7. Next steps

1. Run the migration SQL (or `supabase db push`).
2. Set all Edge Function secrets and `SITE_URL`.
3. Deploy Edge Functions and configure Stripe webhook URL and OAuth redirect URIs as above.
4. Schedule the two cron jobs (or equivalent HTTP cron) for `sync-accounting` and `check-gmail-replies`.
5. In the app: add Stripe keys in **Settings → Integrations** (optional; webhook uses project-level keys). Connect QuickBooks/Xero/Gmail as needed; paid and reply behaviour will run on the defined schedule.
6. Optional: configure Meta Pixel + CAPI per **META_PIXEL_AND_CAPI.md**.
