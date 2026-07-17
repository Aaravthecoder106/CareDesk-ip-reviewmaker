# Phase 1 — Verification Checklist & Runbook

Status legend: **PASS** / **FAIL** / **NOT TESTED (env)** = blocked by environment
configuration (placeholder keys in `.env`, no live Clerk/Supabase project).

Last executed: 2026-07-17 · Commit under test: `76eebed` (Phase 1)

---

## 0. Environment prerequisites (operator setup — do once)

| # | Step | Where |
|---|------|-------|
| 0.1 | Create a NEW Supabase project (do NOT reuse legacy `khmylqheyzuitjsekeyb`; its creds in `_legacy/.env` are exposed — rotate/decommission) | supabase.com |
| 0.2 | Apply migrations: `supabase link --project-ref <ref>` then `supabase db push` (applies `0000` + `0001`) | CLI |
| 0.3 | Create Clerk app; copy `pk_...`/`sk_...` into `.env` | Clerk dashboard |
| 0.4 | Enable Clerk ↔ Supabase native integration: Clerk → Integrations → Supabase; Supabase → Auth → Third-Party Auth → add Clerk (issuer domain) | both dashboards |
| 0.5 | Register webhook: Clerk → Webhooks → endpoint `https://<host>/api/webhooks/clerk`, events `user.created`, `user.updated`, `user.deleted`; copy `whsec_...` → `CLERK_WEBHOOK_SIGNING_SECRET`. For local dev use `ngrok`/`clerk listen` to tunnel. | Clerk dashboard |
| 0.6 | Fill all 6 real values in `.env`; `npm run dev` starts with NO env validation errors | local |

---

## 1. Static gates (runnable without live env)

| # | Check | How | Status |
|---|-------|-----|--------|
| 1.1 | App typecheck | `npx tsc --noEmit` | **PASS** |
| 1.2 | Tests/scripts typecheck | `npx tsc -p tsconfig.tests.json` | **PASS** |
| 1.3 | Lint | `npx eslint .` | **PASS** |
| 1.4 | Unit tests (mapping core) | `npm test` → 5/5 | **PASS** |
| 1.5 | Production build; routes `/api/webhooks/clerk`, `/dashboard`, `/sign-in`, `/sign-up` present | `npm run build` | **PASS** |
| 1.6 | Migration SQL structural check (balanced `$$`, no `auth.` schema writes) | grep | **PASS** |
| 1.7 | Webhook route is middleware-public (signature-authed) | `src/middleware.ts:3` matcher includes `/api/webhooks(.*)` | **PASS** |
| 1.8 | No secrets in git | `git diff --cached`/check-ignore on `.env*` | **PASS** |

## 2. Clerk authentication

| # | Check | How | Status |
|---|-------|-----|--------|
| 2.1 | Anonymous visit to `/dashboard` redirects to `/sign-in` (no 404) | browser, logged out | **NOT TESTED (env)** |
| 2.2 | `/sign-in` and `/sign-up` render Clerk components | browser | **NOT TESTED (env)** |
| 2.3 | Sign-up completes and lands authenticated | browser | **NOT TESTED (env)** |
| 2.4 | Sign-out → `/dashboard` again redirects to `/sign-in` | browser | **NOT TESTED (env)** |
| 2.5 | `/` and `/sign-in` load without auth (public routes) | browser, logged out | **NOT TESTED (env)** |

## 3. Webhook delivery

| # | Check | How | Status |
|---|-------|-----|--------|
| 3.1 | `user.created` delivery returns 200 | Clerk dashboard → Webhooks → Logs | **NOT TESTED (env)** |
| 3.2 | Forged request (bad/absent signature) returns 400, writes nothing | `curl -X POST https://<host>/api/webhooks/clerk -d '{}'` | **NOT TESTED (env)** |
| 3.3 | Replay/duplicate delivery is idempotent (Clerk "resend" → still 200, single row) | Clerk dashboard resend button | **NOT TESTED (env)** |
| 3.4 | `user.updated` (change name in Clerk) updates the row, does NOT reset `role` | update profile, check DB | **NOT TESTED (env)** |
| 3.5 | `user.deleted` removes `users` row and cascades (`patients` gone) | delete test user, check DB | **NOT TESTED (env)** |
| 3.6 | Unsubscribed event type (e.g. `session.created` if sent) returns 200 "ignored" | Clerk logs | **NOT TESTED (env)** |

## 4. User provisioning

| # | Check | How | Status |
|---|-------|-----|--------|
| 4.1 | After sign-up, `public.users` row exists: `id`=Clerk id, correct `email`, names | Supabase table editor / SQL | **NOT TESTED (env)** |
| 4.2 | `role` = `patient` (default; never set by sync) | SQL | **NOT TESTED (env)** |
| 4.3 | Self-heal: delete the user's rows in DB, reload `/dashboard` → rows recreated without webhook | SQL + browser | **NOT TESTED (env)** |

## 5. Patient provisioning

| # | Check | How | Status |
|---|-------|-----|--------|
| 5.1 | `public.patients` row auto-exists with same id after sign-up | SQL | **NOT TESTED (env)** |
| 5.2 | Trigger safety net: `INSERT INTO users (id,email) VALUES ('user_manual','m@x.com');` → patients row appears | SQL as service role | **NOT TESTED (env)** |
| 5.3 | Re-provisioning does not clobber patient data (set `blood_type`, trigger `user.updated`, value survives) | SQL + Clerk | **NOT TESTED (env)** |

## 6. Dashboard loading (round-trip)

| # | Check | How | Status |
|---|-------|-----|--------|
| 6.1 | `/dashboard` renders the caller's users row (id/email/name/role) | browser | **NOT TESTED (env)** |
| 6.2 | Patient section shows "provisioned" | browser | **NOT TESTED (env)** |
| 6.3 | Full journey: fresh sign-up → immediate `/dashboard` visit (beat the webhook) → data still renders (self-heal) | browser, fast | **NOT TESTED (env)** |

## 7. Row Level Security

| # | Check | How | Status |
|---|-------|-----|--------|
| 7.1 | Authenticated read of own `users`/`patients` rows succeeds via anon key + Clerk JWT | `scripts/verify-rls.mjs` checks 1, 5 | **NOT TESTED (env)** |
| 7.2 | Anon key WITHOUT JWT reads zero rows from every table | `curl <url>/rest/v1/users -H "apikey: <anon>"` | **NOT TESTED (env)** |
| 7.3 | `clerk_user_id()` resolves: `SELECT public.clerk_user_id()` under a user JWT returns the Clerk id | SQL / PostgREST rpc | **NOT TESTED (env)** |

## 8. Cross-user isolation

| # | Check | How | Status |
|---|-------|-----|--------|
| 8.1 | A cannot read B's `users` row | `verify-rls.mjs` check 2 | **NOT TESTED (env)** |
| 8.2 | A cannot read B's `reports` | `verify-rls.mjs` check 3 | **NOT TESTED (env)** |
| 8.3 | A cannot UPDATE B's rows / self-promote `role` to admin | `verify-rls.mjs` check 4 | **NOT TESTED (env)** |
| 8.4 | A cannot read B's storage objects (`reports` bucket, B's folder) | storage API with A's JWT | **NOT TESTED (env)** |

## 9. Database records

| # | Check | How | Status |
|---|-------|-----|--------|
| 9.1 | `supabase db push` applies 0000+0001 with zero errors | CLI output | **NOT TESTED (env)** |
| 9.2 | All 16 tables exist, RLS enabled on each | `SELECT relname, relrowsecurity FROM pg_class ...` | **NOT TESTED (env)** |
| 9.3 | `reports` storage bucket exists, `public=false` | dashboard | **NOT TESTED (env)** |
| 9.4 | `updated_at` trigger fires (update a row, timestamp changes) | SQL | **NOT TESTED (env)** |

## 10. Failure cases

| # | Check | How | Status |
|---|-------|-----|--------|
| 10.1 | Webhook with valid signature but DB down/unreachable → 500 (Clerk retries) | temporarily wrong service key | **NOT TESTED (env)** |
| 10.2 | User with no email address → provisioning returns error, webhook 500, no partial row | Clerk test user w/ phone-only, if enabled | **NOT TESTED (env)** |
| 10.3 | Missing env var at boot → t3-env fails fast with a clear message | unset one var, `npm run dev` | **NOT TESTED (env)** |
| 10.4 | Expired/garbage JWT to PostgREST → 401, zero rows | curl with `Bearer garbage` | **NOT TESTED (env)** |

## 11. Edge cases

| # | Check | How | Status |
|---|-------|-----|--------|
| 11.1 | Primary-email fallback: user whose `primary_email_address_id` matches nothing still syncs (first email used) | unit-tested (tests/provisioning.test.ts) — **PASS (unit)**; live optional | **PASS** (unit) |
| 11.2 | Duplicate email in Clerk vs existing DB row → upsert conflict on `users.email` UNIQUE handled (returns 500, no crash) | create 2 Clerk users w/ same email (different instances) | **NOT TESTED (env)** |
| 11.3 | Same user signs up, is deleted in Clerk, signs up again (new Clerk id, same email) → old row must be gone (cascade) before new insert; verify no UNIQUE(email) collision | Clerk delete + re-signup | **NOT TESTED (env)** |
| 11.4 | Out-of-order webhooks (`user.updated` arrives before `user.created`) → upsert converges | Clerk resend in reverse order | **NOT TESTED (env)** |
| 11.5 | Concurrent first-hit + webhook race → single row, no error (self-heal upsert + trigger `ON CONFLICT DO NOTHING`) | fresh signup with fast dashboard hit | **NOT TESTED (env)** |

---

## Sign-off rule

Phase 2 does not start until every item in sections 2–9 is **PASS**, or explicitly
accepted as **blocked by environment configuration** by the founder. Sections 10–11
are required before production launch but do not block Phase 2 development.
