/**
 * RLS cross-user isolation verification (run against a LIVE database).
 *
 * Cannot run in CI with placeholder keys — this is an operator script. It proves
 * the Phase-0 policies actually prevent cross-user reads, using real Clerk JWTs.
 *
 * Prerequisites:
 *   - Migrations 0000 + 0001 applied to the target Supabase project.
 *   - Clerk<->Supabase native integration enabled.
 *   - Two Clerk test users (A and B) each signed in at least once, so their
 *     public.users + public.patients rows exist.
 *   - Each user has at least one report row (create via the app or admin).
 *
 * Usage (PowerShell / bash):
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
 *   USER_A_JWT=<clerk session token for A> \
 *   USER_B_JWT=<clerk session token for B> \
 *   USER_B_ID=<clerk id of B> \
 *   node scripts/verify-rls.mjs
 *
 * Exit code 0 = all isolation checks passed; 1 = a check failed (leak).
 */
import { createClient } from '@supabase/supabase-js'

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  USER_A_JWT,
  USER_B_JWT,
  USER_B_ID,
} = process.env

for (const [k, v] of Object.entries({
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  USER_A_JWT,
  USER_B_JWT,
  USER_B_ID,
})) {
  if (!v) {
    console.error(`Missing required env var: ${k}`)
    process.exit(2)
  }
}

const asUser = (jwt) =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })

const a = asUser(USER_A_JWT)
const b = asUser(USER_B_JWT)

let failures = 0
const check = (name, passed, detail = '') => {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!passed) failures++
}

// 1. A can read their own users row.
{
  const { data, error } = await a.from('users').select('id').limit(5)
  check('A reads own users row', !error && Array.isArray(data) && data.length >= 1, error?.message)
}

// 2. A cannot read B's users row by id (RLS returns 0 rows, not an error).
{
  const { data, error } = await a.from('users').select('id').eq('id', USER_B_ID)
  check('A cannot read B users row', !error && (data?.length ?? 0) === 0, error?.message)
}

// 3. A cannot read B's reports.
{
  const { data, error } = await a.from('reports').select('id').eq('patient_id', USER_B_ID)
  check('A cannot read B reports', !error && (data?.length ?? 0) === 0, error?.message)
}

// 4. A cannot self-promote role (column not granted -> update blocked/no-op).
{
  const { error } = await a.from('users').update({ role: 'admin' }).eq('id', USER_B_ID)
  // Either an explicit error, or zero rows affected; re-read to be sure.
  const { data: check4 } = await b.from('users').select('role').limit(1)
  check(
    'A cannot escalate B role to admin',
    (check4?.[0]?.role ?? 'patient') !== 'admin',
    error?.message,
  )
}

// 5. B can read their own patient profile (proves auto-provisioning + RLS).
{
  const { data, error } = await b.from('patients').select('id').limit(1)
  check('B reads own patient profile', !error && (data?.length ?? 0) === 1, error?.message)
}

console.log('')
if (failures > 0) {
  console.error(`${failures} check(s) FAILED — RLS is not isolating users correctly.`)
  process.exit(1)
}
console.log('All RLS isolation checks passed.')
