# Security & Architecture Upgrade (Development Branch)

This document describes the isolated implementation on `feature/security-and-architecture-upgrade`.

## Safety boundary

- The migration in this branch has **not** been applied to the connected Supabase project.
- No Production database schema, RLS policy, data, Auth setting, or Edge Function was changed.
- No Edge Function was deployed and no AI secret was created or changed.
- No pull request was opened, no merge was performed, and no production deployment was started.
- Apply the migration only to a disposable/local database or an explicitly approved Supabase development branch after reviewing the SQL.

## Database changes prepared

Migration: `supabase/migrations/20261120180000_server_side_blueprints_and_ai_drafts.sql`

It is written against the live schema inspected for this project:

- `questions.options`, `correct_answer_index`, `category_id`, `deleted_at`
- `exam_attempts.question_ids` and `user_answers` are UUID/integer arrays
- `user_seen_questions.seen_question_ids` is a UUID array
- `exam_attempts.finished_at`, `blueprint_id`, and `duration_seconds`

The migration prepares:

1. `profiles.status` with `active|banned`.
2. `exam_blueprints` with JSONB quota rules.
3. `ai_question_drafts` for review-before-publish.
4. `private.is_admin()` as an RLS helper in a non-exposed schema.
5. Admin-only direct access to `questions`; learners use the allow-listed `v_questions_public` view.
6. Revocation of direct client access to `user_seen_questions`, `v_item_exposure`, and `system_config`.
7. Server-side sampling RPCs:
   - `create_exam_attempt_sampled(mode,count,category_id,exam_year_id)`
   - `create_exam_attempt_from_blueprint(blueprint_code)`
8. A row-locked, idempotent `submit_exam` that awards EXP once.
9. Atomic `review_ai_question_draft(draft_id,approve)`.

The blueprint rules used by the current UI are based on the existing `categories.id` values. The live database currently has three categories, not the five subject groups shown in the illustrative SQL supplied in the project brief. Taxonomy mapping should be completed before creating a five-subject blueprint.

## Next.js routes prepared

- `/admin/questions` — question create/edit and soft-delete.
- `/admin/import` — CSV import (up to 500 questions per request).
- `/admin/taxonomy` — add categories and exam years.
- `/admin/blueprints` — create/edit/activate blueprint quotas.
- `/admin/ai-generator` — generate AI drafts and review them.
- `/admin/users` — view members and suspend/restore accounts.
- `/dashboard` — lists active blueprints and existing practice modes.

Admin route layouts and server actions call `requireAdmin()`. Database writes remain subject to RLS.

## AI Edge Function

Function source: `supabase/functions/generate-questions/index.ts`

The function:
- requires a valid Supabase JWT (`verify_jwt = true`);
- verifies the user and checks `profiles.role = 'admin'`;
- reads `GEMINI_API_KEY` only from server environment secrets;
- validates AI output and writes to `ai_question_drafts`, not directly to `questions`;
- uses a configured origin for CORS.

Before deploying in a development environment, set secrets:

```bash
supabase secrets set GEMINI_API_KEY="YOUR_KEY"
supabase secrets set APP_ORIGIN="http://localhost:3000"
# Optional
supabase secrets set GEMINI_MODEL="gemini-2.5-flash"
supabase functions deploy generate-questions
```

For production, set `APP_ORIGIN` to the exact production origin. Do not put the AI key in `NEXT_PUBLIC_*`, `system_config`, source files, or browser code. If a previous key was ever loaded into a browser, rotate it at the AI provider.

## Environment

The Next.js app continues to use:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Never use a Supabase service-role/secret key in a `NEXT_PUBLIC_*` variable.

## Verification still required

Before this branch can be considered ready:

1. Apply the migration to a local or isolated Supabase development database.
2. Run SQL checks for function existence, RLS, grants, and view columns.
3. Test as anon, ordinary authenticated user, active admin, and banned user.
4. Test unseen-first selection, fallback after unseen exhaustion, and insufficient quota.
5. Test two simultaneous submissions and confirm EXP is awarded once.
6. Test AI function with invalid JWT, non-admin JWT, malformed AI output, and successful draft creation.
7. Test approval/rejection concurrency and verify one question is created at most once.
8. Run `npm ci` (after adding/committing a lockfile), `npm run lint`, and `npm run build`.
9. Run browser smoke tests for user/admin routes.

The GitHub Actions build status has not yet been confirmed green. This branch must not be merged or deployed until these checks pass and the owner approves the next step.
