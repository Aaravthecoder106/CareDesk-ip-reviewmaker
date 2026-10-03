# Guest → Authenticated Migration — Verification Report

**Project:** CareDesk (`CareDesk-ip-reviewmaker`)
**Scope:** Guest uploads a report → sees the teaser (70% preview) → signs up → the report must appear in their Report Library with the full analysis unlocked.
**Date:** 2026-10-04

---

## 0. Root causes found and fixed

The migration plumbing (`/api/public/migrate`, `GuestMigration`, `preview_tokens`) already existed but was broken in **four** places. All four are fixed in this change.

| # | Root cause | Evidence | Fix |
|---|-----------|----------|-----|
| 1 | **Signup never reached the dashboard.** Clerk's default after-sign-up target is `/`. `<GuestMigration />` only mounts in `dashboard/layout.tsx:23`, so migration never fired. | `src/app/sign-up/[[...sign-up]]/page.tsx` rendered a bare `<SignUp />` | `<SignUp forceRedirectUrl="/dashboard" />` (+ `fallbackRedirectUrl` on sign-in) |
| 2 | **Provisioning race → FK failure.** `reports.patient_id` → `patients.id`. The Clerk `user.created` webhook is async; `/dashboard/reports` is a client page that never self-heals. A brand-new signup had no `patients` row when the insert ran → 500 → report lost. | `migrate/route.ts` inserted with no provisioning call, while `users.ts:60` (`ensureCurrentUserProvisioned`) was only used by `/dashboard` | `ensureCurrentUserProvisioned()` now runs **before any insert**, inside the endpoint |
| 3 | **Permanent failure latch.** `sessionStorage` "attempted" flag was set *before* the request, so one transient 5xx blocked every retry for that tab. | `guest-migration.tsx:31-33` | Latch is set up-front (prevents double-fire) but **released** on retryable outcomes (401/425/5xx/network) |
| 4 | **401 surfaced as a scary error.** The component can fire before the session cookie settles. | `guest-migration.tsx` generic error branch | 401 → silent skip, token preserved, retried next load |

---

## 1. Endpoint implementation — `POST /api/public/migrate`

**File:** `src/app/api/public/migrate/route.ts`

The route is now a thin shell: auth → parse → **provision** → load session → delegate to the pure core (`src/lib/guest-migration.ts`) → map result to HTTP. The core is dependency-injected, which is what makes the flow unit-testable (§7).

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { ensureCurrentUserProvisioned } from '@/lib/data/users'
import { runMigration, type MigrationDb, type MigrationStorage } from '@/lib/guest-migration'
import { logger } from '@/lib/logger'

const ROUTE = '/api/public/migrate'

interface MigrateBody {
  previewToken?: string
}

export async function POST(req: NextRequest) {
  const start = Date.now()

  try {
    // ── Auth ───────────────────────────────────────────────────────────
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    // ── Body ───────────────────────────────────────────────────────────
    let body: MigrateBody
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    const { previewToken } = body
    if (!previewToken || typeof previewToken !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing previewToken' }, { status: 400 })
    }

    // ── Provision BEFORE any insert (FK: reports.patient_id → patients) ─
    try {
      await ensureCurrentUserProvisioned()
    } catch (provErr) {
      const msg = provErr instanceof Error ? provErr.message : String(provErr)
      logger.error({ route: ROUTE, step: 'provision', userId, err: msg }, 'Provisioning failed')
      return NextResponse.json(
        { success: false, error: 'Your account is still being set up. Try again in a moment.' },
        { status: 503 },
      )
    }

    const admin = createAdminSupabaseClient()

    // ── Step A: retrieve the guest session ─────────────────────────────
    const { data: session, error: sessionError } = await admin
      .from('preview_tokens')
      .select('*')
      .eq('token', previewToken)
      .single()

    if (sessionError || !session) {
      logger.warn({ route: ROUTE, token: previewToken.slice(0, 8) }, 'Preview token not found')
      return NextResponse.json({ success: false, error: 'Preview session not found' }, { status: 404 })
    }

    // ── Steps B–G ──────────────────────────────────────────────────────
    const result = await runMigration(session, userId, {
      db: makeDb(admin),
      storage: makeStorage(admin),
    })

    const durationMs = Date.now() - start

    switch (result.status) {
      case 'migrated':
        logger.info(
          { route: ROUTE, userId, reportId: result.reportId, fileMovedOk: result.fileMovedOk,
            counts: result.counts, warnings: result.warnings, durationMs },
          'Guest migration completed successfully',
        )
        return NextResponse.json({
          success: true, reportId: result.reportId, redirect: '/dashboard/reports',
        })

      case 'already-migrated':
        return NextResponse.json({
          success: true, reportId: result.reportId, alreadyMigrated: true,
          redirect: '/dashboard/reports',
        })

      case 'duplicate':
        return NextResponse.json({
          success: true, reportId: result.reportId, duplicate: true,
          redirect: '/dashboard/reports',
        })

      case 'owned-elsewhere':
        return NextResponse.json(
          { success: false, error: 'This session has already been migrated to another account' },
          { status: 409 },
        )

      case 'expired':
        return NextResponse.json({ success: false, error: result.message }, { status: 410 })

      case 'analysis-not-ready':   // retryable: session stays alive
        return NextResponse.json({ success: false, error: result.message }, { status: 425 })

      case 'error':
        return NextResponse.json({ success: false, error: result.message }, { status: 500 })

      default:
        return NextResponse.json(
          { success: false, error: 'Migration failed. Please try uploading again.' },
          { status: 500 },
        )
    }
  } catch (err) {
    const durationMs = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ route: ROUTE, durationMs, err: msg }, 'Migration failed')
    return NextResponse.json(
      { success: false, error: `Migration failed: ${msg.slice(0, 200)}` },
      { status: 500 },
    )
  }
}
```

The Supabase-backed `makeDb()` / `makeStorage()` adapters live in the same file (below the handler) and implement the `MigrationDb` / `MigrationStorage` interfaces declared in `src/lib/guest-migration.ts`.

**Response contract**

| `result.status` | HTTP | Body |
|---|---|---|
| `migrated` | 200 | `{ success: true, reportId, redirect: "/dashboard/reports" }` |
| `already-migrated` | 200 | `{ success: true, reportId, alreadyMigrated: true }` |
| `duplicate` | 200 | `{ success: true, reportId, duplicate: true }` |
| `owned-elsewhere` | 409 | `{ success: false, error }` |
| `expired` | 410 | `{ success: false, error }` |
| `analysis-not-ready` | 425 | `{ success: false, error }` |
| `error` | 500 | `{ success: false, error }` |
| no session row | 404 | `{ success: false, error }` |
| not authenticated | 401 | `{ success: false, error }` |
| provisioning failed | 503 | `{ success: false, error }` |

---

## 2. Frontend component — auto-migration trigger after signup

**Files:**
- `src/components/guest-migration.tsx` (trigger, mounted in `src/app/dashboard/layout.tsx:23`)
- `src/app/sign-up/[[...sign-up]]/page.tsx` (**new:** forces the post-signup landing onto `/dashboard`)
- `src/app/preview/[token]/page.tsx` (already calls `savePreviewTokenForMigration(token)` on teaser load)

**Signup redirect (the fix that makes the trigger reachable at all):**

```tsx
<SignUp forceRedirectUrl="/dashboard" />
```

**Trigger — full source:**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

const STORAGE_KEY = 'caredesk_preview_token'

type MigrationState = 'idle' | 'migrating' | 'success' | 'error'

interface MigrateResponse {
  success?: boolean
  reportId?: string | null
  redirect?: string
  alreadyMigrated?: boolean
  duplicate?: boolean
  error?: string
}

export function GuestMigration() {
  const router = useRouter()
  const [state, setState] = useState<MigrationState>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY)
    if (!token) return // No guest session — nothing to migrate

    // Prevent concurrent duplicate attempts. Released again on retryable failures.
    const attemptKey = `${STORAGE_KEY}_attempted_${token}`
    if (sessionStorage.getItem(attemptKey)) return
    sessionStorage.setItem(attemptKey, '1')

    async function runMigration() {
      setState('migrating')
      setMessage('Migrating your report…')

      try {
        const res = await fetch('/api/public/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ previewToken: token }),
        })

        let data: MigrateResponse = {}
        try { data = (await res.json()) as MigrateResponse } catch { data = {} }

        // Not signed in yet — keep the token, release the latch, retry next load.
        if (res.status === 401) {
          sessionStorage.removeItem(attemptKey)
          setState('idle')
          return
        }

        if (res.ok && data.success) {
          localStorage.removeItem(STORAGE_KEY)
          sessionStorage.setItem(attemptKey, '1')
          setMessage(data.alreadyMigrated || data.duplicate
            ? 'Report already in your library!'
            : 'Report migrated successfully!')
          setState('success')

          setTimeout(() => {
            setState('idle')
            router.push(data.redirect || '/dashboard/reports')
            router.refresh()
          }, 1500)
          return
        }

        // Terminal: consume the token, do not retry.
        if (res.status === 404 || res.status === 409) {
          localStorage.removeItem(STORAGE_KEY)
          sessionStorage.setItem(attemptKey, '1')
          setState('idle')
          return
        }

        if (res.status === 410) {
          localStorage.removeItem(STORAGE_KEY)
          sessionStorage.setItem(attemptKey, '1')
          setMessage('Your preview session expired. Upload a new report.')
          setState('error')
          setTimeout(() => setState('idle'), 4000)
          return
        }

        // Retryable (425 / 5xx / other): release the latch, keep the token.
        sessionStorage.removeItem(attemptKey)
        setMessage(data.error || 'Migration failed. It will retry automatically — you can also reload the page.')
        setState('error')
        setTimeout(() => setState('idle'), 5000)
      } catch {
        sessionStorage.removeItem(attemptKey)
        setMessage('Network error while migrating. Reload the page to retry.')
        setState('error')
        setTimeout(() => setState('idle'), 5000)
      }
    }

    runMigration()
  }, [router])

  if (state === 'idle') return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className={`glass-panel-strong rounded-xl px-5 py-4 shadow-xl border max-w-sm flex items-center gap-3
        ${state === 'success' ? 'border-green-300/50' : state === 'error' ? 'border-destructive/30' : 'border-electric-blue/30'}`}>
        {state === 'migrating' && <Loader2 className="size-5 animate-spin text-electric-blue shrink-0" />}
        {state === 'success' && <CheckCircle2 className="size-5 text-green-600 shrink-0" />}
        {state === 'error' && <AlertCircle className="size-5 text-destructive shrink-0" />}
        <p className="text-[14px] text-deep-navy font-medium">{message}</p>
      </div>
    </div>
  )
}

export function savePreviewTokenForMigration(token: string) {
  if (typeof window !== 'undefined' && token && token !== 'inline') {
    localStorage.setItem(STORAGE_KEY, token)
  }
}
```

**Flow:** teaser load → `localStorage['caredesk_preview_token'] = <token>` → "Sign Up Free" → `/sign-up` → **signup completes → forced to `/dashboard`** → `GuestMigration` mounts → `POST /api/public/migrate` → success toast → `router.push('/dashboard/reports')` + `router.refresh()` → library shows the report.

---

## 3. Database queries

### Schema (applied from `supabase/migrations/`)

```sql
-- 0005_preview_tokens.sql — guest session store ("guest_sessions" in the spec)
CREATE TABLE public.preview_tokens (
  token        TEXT PRIMARY KEY,
  file_path    TEXT NOT NULL,
  mime_type    TEXT NOT NULL DEFAULT 'application/pdf',
  file_name    TEXT NOT NULL,
  summary      TEXT,
  lab_results  JSONB NOT NULL DEFAULT '[]'::jsonb,
  medications  JSONB NOT NULL DEFAULT '[]'::jsonb,
  conditions   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.preview_tokens ENABLE ROW LEVEL SECURITY;  -- service-role only

-- 0007_guest_migration.sql — idempotency columns
ALTER TABLE public.preview_tokens
  ADD COLUMN IF NOT EXISTS migrated_user_id TEXT,
  ADD COLUMN IF NOT EXISTS migrated_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS preview_tokens_migrated_idx
  ON public.preview_tokens(migrated_user_id)
  WHERE migrated_user_id IS NOT NULL;
```

### Runtime statements (service-role client, RLS bypassed by design)

```sql
-- Step A: load guest session
SELECT * FROM preview_tokens WHERE token = $1;                       -- .single()

-- Step 0: identity self-heal (FK target) — provisionUser() from lib/data/provisioning.ts
INSERT INTO users (id, email, first_name, last_name)
VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
INSERT INTO patients (id) VALUES ($1) ON CONFLICT (id) DO NOTHING;

-- Duplicate check: same user, same title (+ same analysis when available)
SELECT id, ai_summary FROM reports
WHERE patient_id = $1 AND title = $2
ORDER BY created_at DESC LIMIT 5;

-- Step C: permanent report
INSERT INTO reports (patient_id, title, file_path, mime_type, ai_summary, status)
VALUES ($1, $2, $3, $4, $5, 'ready') RETURNING id;

-- Step D: lab values
INSERT INTO lab_results (report_id, patient_id, test_name, value, unit, flag, test_date)
VALUES (...);

-- Step E: conditions
INSERT INTO conditions (patient_id, name, status, diagnosed_at) VALUES (...);

-- Step F: medications
INSERT INTO medications (patient_id, name, dose, frequency, status) VALUES (...);

-- Step G: close the session (idempotency)
UPDATE preview_tokens
SET migrated_user_id = $1, migrated_at = $2
WHERE token = $3;

-- Report Library read (RLS-scoped, Clerk JWT)
SELECT * FROM reports WHERE patient_id = auth.uid_equivalent()  -- policy: public.clerk_user_id() = patient_id
ORDER BY created_at DESC;
```

**Ordering guarantee:** the `reports` insert is first and fatal; dependent rows are best-effort; the session is stamped **last**. A failure therefore never leaves a stamped-but-empty session, and a retry is always possible.

---

## 4. Storage operations

Bucket: `reports` (private). Guest files live at `__guest__/{token}.{ext}` (written by `/api/public/analyze`).

```ts
// Step B — move guest file → authenticated path
const targetPath = `${userId}/${fileName}`            // e.g. user_2xyz/blood-report.pdf

const { data: fileData } = await bucket.download(from)          // 1. read guest copy
await bucket.upload(to, fileData, { contentType, upsert: true }) // 2. write user copy
await bucket.remove([from])                                      // 3. delete guest copy (best-effort)
```

**Failure handling:**

| Situation | Behaviour |
|---|---|
| Guest copy missing (already deleted / partial earlier attempt) | Warning only — the report row is still created (spec: *"create report record anyway"*). If a file already exists at the target path (an earlier attempt moved it), that path is used so the report stays viewable. |
| Upload to user path fails | Warning only, original guest path kept on the row. |
| Guest file never stored (storage was down at upload time) | `file_path` empty → row created with an empty path. |
| Delete of guest copy fails | Ignored — a stray guest file is harmless. |

---

## 5. Error handling — every failure scenario

| Scenario | Detected by | HTTP | User sees | Token state | Retry? |
|---|---|---|---|---|---|
| Guest session expired (>48h) | `checkSession` | **410** | "Your preview session expired. Upload a new report." | consumed | no |
| Session already migrated (same user) | `migrated_user_id` | **200** `alreadyMigrated` | "Report already in your library!" → library | consumed | n/a |
| Session migrated to another account | `migrated_user_id` | **409** | silent (toast dismissed) | consumed | no |
| Storage file not found | `moveFile` error | **200** | report created, file path degraded | consumed | n/a |
| Analysis incomplete | `analysisIsReady` | **425** | "Analysis is still processing. Try again in a moment." | kept | **yes** |
| Duplicate (same title + analysis already in library) | `findDuplicateReport` | **200** `duplicate` | "Report already in your library!" | consumed | n/a |
| Database insert fails | `insertReport` | **500** | "Failed to create report. Please try uploading from the dashboard." | kept, latch released | **yes** |
| Dependent insert fails (labs/conditions/meds) | `insert*Rows` | **200** + warning log | report migrates; extracted rows retried only via re-upload | consumed | n/a |
| Provisioning failed (no `users`/`patients` row) | `ensureCurrentUserProvisioned` | **503** | "Your account is still being set up. Try again in a moment." | kept, latch released | **yes** |
| Not authenticated (cookie not settled) | `auth()` | **401** | silent | kept, latch released | **yes** |
| Stale token (row gone) | `.single()` miss | **404** | silent | consumed | no |
| Network error / malformed body | client `catch` / `req.json()` | — / 400 | "Network error while migrating. Reload the page to retry." | kept, latch released | **yes** |

Covered by tests: expired, analysis-not-ready, already-migrated, owned-elsewhere, duplicate, storage-missing, partial-move, report-insert-failure, dependent-insert-failure, stamp-failure (§7).

---

## 6. Data extraction logic

**Source shape** (produced by the guest analyzer and stored as JSONB in `preview_tokens`):

```json
{
  "summary": "A clear 2-3 sentence summary of the report",
  "labResults":   [{ "test_name": "Fasting Glucose", "value": 145, "unit": "mg/dL", "flag": "high" }],
  "medications":  [{ "name": "Metformin", "dose": "500mg", "frequency": "twice daily" }],
  "conditions":   [{ "name": "Type 2 Diabetes", "status": "active" }]
}
```

**Mappers** (`src/lib/guest-migration.ts`):

```ts
mapLabRows(reportId, patientId, raw)
  // keys: test_name | name  → 'Unknown Test' fallback
  // value: number kept; numeric strings ("6.8") parsed; junk → NULL
  // unit / flag: trimmed strings, empty → NULL
  // test_date: NULL (no reliable report date in the payload)

mapConditionRows(patientId, raw)
  // keys: name | test_name → 'Unknown Condition'
  // status: text or NULL; diagnosed_at: NULL

mapMedicationRows(patientId, raw)
  // name required ('Unknown Medication' fallback)
  // dose: `dose`, falling back to `dosage`; frequency: text or NULL
  // status: 'active' (schema default)
```

Non-object / array entries in the JSONB are dropped rather than inserted as junk. Every mapped row carries `patient_id` (RLS key) and, for labs, `report_id` (FK to the new report).

---

## 7. Test scenario walk-through

### 7a. Automated simulation (executed here)

`tests/guest-migration.test.ts` drives `runMigration()` through the entire sequence with in-memory fakes — the same code path the HTTP route executes after auth.

| # | Verification point | Test | Result |
|---|---|---|---|
| 1 | Session validation (fresh / 48h-expired / analysis-not-ready) | `checkSession` tests ×3 + `analysisIsReady` | ✅ PASS |
| 2 | Storage path helper | `userStoragePath` | ✅ PASS |
| 3 | Lab extraction (numbers, numeric strings, junk, missing name) | `mapLabRows` | ✅ PASS |
| 4 | Condition + medication extraction | `mapConditionRows`, `mapMedicationRows` | ✅ PASS |
| 5 | **Full migration:** report row + labs + conditions + meds + file move + session stamp | `migrates a guest session end-to-end…` | ✅ PASS |
| 6 | Idempotency: second run → `already-migrated`, no duplicate row | `second run…` | ✅ PASS |
| 7 | Ownership: migrated elsewhere → rejected, zero writes | `session already migrated to ANOTHER account…` | ✅ PASS |
| 8 | Short-circuits (expired / not-ready) leave zero writes | 2 tests | ✅ PASS |
| 9 | Duplicate guard → existing report id, stamped, no file move | `same upload already in the library…` | ✅ PASS |
| 10 | Storage failures (missing file / partial move) still create the report | 2 tests | ✅ PASS |
| 11 | Report insert failure → error, nothing else written, no stamp | `report insert failure…` | ✅ PASS |
| 12 | Dependent insert + stamp failures are non-fatal and surfaced | 2 tests | ✅ PASS |
| 13 | Result → HTTP discriminant contract for all 6 outcomes | `every migration result carries a discriminant…` | ✅ PASS |

**Gate results (all executed):**

| Gate | Command | Result |
|---|---|---|
| Typecheck (app) | `npx tsc --noEmit` | ✅ **PASS** (0 errors) |
| Typecheck (tests) | `npx tsc -p tsconfig.tests.json` | ✅ **PASS** (0 errors) |
| Lint | `npx eslint .` | ✅ **PASS** (0 errors, 0 warnings) |
| Unit tests | `npm test` | ✅ **PASS — 25/25** (20 new guest-migration + 5 existing provisioning) |
| Production build | `npm run build` (SKIP_ENV_VALIDATION=1) | ✅ **PASS** — routes `/api/public/migrate`, `/dashboard/reports`, `/sign-up`, `/sign-in` present |

### 7b. Hosted browser walk-through (run on your Vercel deployment)

Vercel is connected to `main`, so commit `54da03a` deploys automatically. Confirm in
Vercel → Deployments that the newest deployment's commit is `54da03a` before testing.
Run this against the **production URL** (production env vars + production Supabase):

No live Supabase/Clerk/Gemini credentials exist in this workspace, so the browser legs are yours to run. Exact steps + expected evidence:

| Step | Action | Expected | Your result |
|---|---|---|---|
| 1 | Open landing page in a **fresh profile / after clearing site data** | Upload UI visible | ☐ |
| 2 | Upload a PDF or image | "Analyzing…" → redirect to `/preview/<token>` | ☐ |
| 3 | Teaser renders | AI Summary full, first **3 labs / 2 meds / 2 conditions** visible, remainder blurred with "N more" | ☐ |
| 4 | DevTools → Application → Local Storage | `caredesk_preview_token = <token>` present | ☐ |
| 5 | Click **Sign Up — It's Free** | `/sign-up` renders | ☐ |
| 6a | Sign up with **email/password** | Lands on **/dashboard** (not `/`) | ☐ |
| 6b | Repeat with **Google OAuth** (2nd test user) | Lands on **/dashboard** | ☐ |
| 7 | Toast appears | "Migrating your report…" → "Report migrated successfully!" | ☐ |
| 8 | Auto-redirect | `/dashboard/reports` lists the uploaded report (title = filename, status **Analyzed**, AI summary shown) | ☐ |
| 9 | Local Storage check | `caredesk_preview_token` **gone** | ☐ |
| 10 | Open the report / Analytics / Chat | Full analysis — no blur, no "sign up" wall; lab values present | ☐ |
| 11 | SQL check in Supabase | 1 row in `reports` for your user; rows in `lab_results`/`conditions`/`medications` linked to it; `preview_tokens.migrated_user_id` set | ☐ |
| 12 | Reload `/dashboard/reports` twice | No duplicate report appears (idempotency) | ☐ |

---

## 8. Known limitations

1. **Migrations must be applied.** Requires `0005_preview_tokens.sql` **and** `0007_guest_migration.sql`. Note: `COMBINED_ALL_MIGRATIONS.sql` in the repo is **stale** (537 lines, stops before `preview_tokens`) — run the individual files, not the combined one. Without `0007`, the endpoint still returns success (the stamp failure is a warning) but repeat migrations can't be detected server-side.
2. **No DB transaction.** Supabase JS can't wrap multiple statements; ordering (report first, stamp last) is what prevents a poisoned state. Labs/conditions/meds are best-effort — if they fail, the report exists but the extracted rows don't, and there is no automatic backfill.
3. **The inline fallback cannot migrate.** If `preview_tokens` was unavailable at upload time, `/api/public/analyze` returns `inline: true` and the preview is served from `sessionStorage` — there is no server-side session to migrate (that path is already broken *before* signup; unrelated to this fix).
4. **Windows are fixed:** preview expires at 24h (`/api/public/preview`), migration allowed up to 48h. A session between 24–48h old can still migrate (the migration path does not re-check the 24h preview limit), but the teaser link itself will 410.
5. **Duplicate detection is title + analysis**, not a content hash. Two uploads of the *same file name with different content* are treated as different reports (correct); two uploads of byte-identical content under the same name collapse to one (intended).
6. **`brandColor`/branding of migrated files** — none applied; files are moved verbatim.
7. **No cleanup job** for stale `preview_tokens` rows or orphaned `__guest__/` objects (pre-existing; cron not in scope).
8. **Teaser is slice-based, not literal 70%** — first 3 labs / 2 meds / 2 conditions are shown, the rest blurred. With a small report (< 3 labs) the teaser shows everything.
9. **Screenshots** of the live library/mobile run are not producible from this workspace (no hosted session, no browser) — use the §7b table.

---

## 9. Mobile test

**Status: NOT TESTED (env)** — no live hosted session available from this workspace.

What is already verified statically:

- The preview page, dashboard and Report Library are responsive by construction: breakpoint prefixes (`sm:`, `px-4 sm:px-6`), `100dvh` layout, and `env(safe-area-inset-bottom)` padding in `dashboard/layout.tsx`.
- The migration trigger is viewport-independent (localStorage + fetch + router push) — no desktop-only APIs.

**Mobile runbook (same steps as §7b, phone browser):**

1. On the phone, clear site data for the hosted domain, open the landing page.
2. Upload a report → teaser renders, scroll confirms blurred rows + "Sign Up" CTA are tappable.
3. Tap **Sign Up — It's Free** → complete signup (Google on mobile).
4. Expect: lands on `/dashboard` → "Migrating your report…" toast (bottom-right, above safe area) → Report Library lists the report.
5. Open the report → full analysis, no blur.
6. Rotate to landscape and re-check the library card renders.

| Check | Result |
|---|---|
| Upload works on mobile | ☐ |
| Teaser + CTA render correctly | ☐ |
| Signup completes → dashboard | ☐ |
| Migration toast + report appears | ☐ |
| Full analysis unlocked | ☐ |

---

## Appendix — files changed

| File | Change |
|---|---|
| `src/lib/guest-migration.ts` | **new** — pure migration core (validation, extraction, orchestration, injected deps) |
| `src/app/api/public/migrate/route.ts` | rewired: `ensureCurrentUserProvisioned()` before inserts; delegates to core; explicit status → HTTP mapping |
| `src/components/guest-migration.tsx` | retry-safe latch, silent 401, typed response, 425 handling |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | `<SignUp forceRedirectUrl="/dashboard" />` |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | `<SignIn fallbackRedirectUrl="/dashboard" />` |
| `tests/guest-migration.test.ts` | **new** — 20 tests covering the whole flow |
| `GUEST_MIGRATION_REPORT.md` | **new** — this report |
