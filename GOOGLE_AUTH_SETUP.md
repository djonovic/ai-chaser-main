# Google Auth Setup (Supabase + ChaseAI)

This project now supports Google OAuth via `supabase.auth.signInWithOAuth`.

Use this checklist to enable it in production first (`https://app.chaseai.app`).

## 1) Create Google OAuth credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create/select your project.
3. Go to `APIs & Services` -> `OAuth consent screen`.
4. Configure app name (for example `ChaseAI`) and support email.
5. Add required authorized domains for your deployment.
6. Go to `APIs & Services` -> `Credentials` -> `Create Credentials` -> `OAuth client ID`.
7. Choose application type `Web application`.
8. Add:
   - Authorized JavaScript origins:
     - `https://app.chaseai.app`
   - Authorized redirect URIs:
     - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
9. Save and copy the `Client ID` and `Client Secret`.

## 2) Enable Google provider in Supabase

1. Open Supabase Dashboard for this app.
2. Go to `Authentication` -> `Providers` -> `Google`.
3. Enable provider and paste Google `Client ID` and `Client Secret`.
4. Save.

## 3) Set auth redirect URLs in Supabase

1. Go to `Authentication` -> `URL Configuration`.
2. Set `Site URL` to:
   - `https://app.chaseai.app`
3. Add `Redirect URLs`:
   - `https://app.chaseai.app/auth`
   - `https://app.chaseai.app/auth/reset-password`
   - (optional local) `http://localhost:5173/auth`
   - (optional local) `http://localhost:5173/auth/reset-password`

## 4) Verify in app

1. Open `/auth`.
2. Click `Continue with Google` (or `Sign up with Google`).
3. Complete consent.
4. Confirm you return to `/auth` and are redirected to your target page (defaults to `/dashboard` or `next` query param).

## Notes

- Google OAuth handles both login and account creation. First-time Google users get new `auth.users` records.
- Existing profile trigger should still populate `public.profiles` for new OAuth users.
- If redirect fails, re-check:
  - Google redirect URI uses Supabase callback URL exactly.
  - Supabase Site URL and Redirect URLs include your app domain.
