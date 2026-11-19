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
