# Next.js App Router migration

This branch adds a Next.js App Router application alongside the existing legacy HTML/JS and React code. Existing app files, SQL migrations, seed data, and the Supabase database are intentionally preserved.

## Setup
1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Run `npm install`.
4. Run `npm run dev`.

## Authentication
- Email/password sign-in and sign-up
- Google OAuth initiation
- PKCE callback exchange
- Password reset email and password update
- Cookie-based browser/server clients via `@supabase/ssr`
- `proxy.ts` refreshes sessions and verifies claims
- Protected routes: `/dashboard`, `/exam`, `/profile`
- Admin-only route: `/admin`, verified server-side through `profiles.role`

No database migrations are run by this scaffold. Existing Supabase tables and RLS policies remain unchanged.

## Migration status
This is the first migration foundation. The legacy exam engine, question bank, admin CRUD, CSV import, blueprint sampling, attempt submission/review, and visual design still need to be ported and tested before production cutover.


## Required Supabase dashboard settings

In Supabase Dashboard → Authentication → URL Configuration:

- Set the local Site URL to `http://localhost:3000` during local development.
- Add `http://localhost:3000/auth/callback` to the Redirect URLs list.
- Before production, add the production origin and its `/auth/callback` URL.
- Confirm the Google provider is enabled and its OAuth client settings are valid.

## Deployment warning

The current `.github/workflows/deploy.yml` publishes static files to GitHub Pages. It cannot host this cookie-based Next.js App Router server runtime. Keep the existing workflow and `main` branch untouched during migration. Choose a Node.js-capable host (for example Vercel or a supported Cloudflare Workers deployment) and configure its environment variables before production cutover.
