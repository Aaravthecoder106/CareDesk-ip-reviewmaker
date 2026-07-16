import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { mapToUserRow, type NormalizedClerkUser } from './provisioning-map'

/**
 * Identity provisioning: Clerk user -> public.users (+ public.patients).
 *
 * Replaces the legacy `handle_new_user()` trigger, which fired on
 * `auth.users`. Under Clerk there is no `auth.users` table, so a signed
 * webhook (verified upstream) is the only sync path. Justification:
 * Compatibility — the trigger mechanism no longer exists.
 *
 * All functions are idempotent (upsert on the primary key), so duplicate or
 * out-of-order webhook deliveries and the app-side self-heal path converge on
 * the same row without conflict.
 *
 * Pure mapping helpers live in ./provisioning-map (unit-testable, no
 * `server-only`); they are re-exported here for callers' convenience.
 */

export {
  fromUserJSON,
  fromUserResource,
  mapToUserRow,
  type NormalizedClerkUser,
} from './provisioning-map'

type AdminClient = SupabaseClient<Database>

/**
 * Upsert the users row and ensure the matching patients profile exists.
 *
 * `role` is intentionally NOT written here: it defaults to 'patient' on insert
 * and is never overwritten on update, so a role assigned out-of-band (e.g. an
 * admin promoting a doctor) survives subsequent profile syncs.
 *
 * The patients row is created for every user because the product is
 * patient-first (the doctor portal is deferred); a users row without a patient
 * profile cannot use any Phase-1 feature. The DB also enforces this via an
 * AFTER INSERT trigger (migration 0001) as a safety net.
 */
export async function provisionUser(
  admin: AdminClient,
  user: NormalizedClerkUser,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = mapToUserRow(user)
  if (!row) return { ok: false, error: 'user has no email address' }

  const { error: userError } = await admin
    .from('users')
    .upsert(row, { onConflict: 'id' })
  if (userError) return { ok: false, error: `users upsert: ${userError.message}` }

  // Idempotent patient provisioning (ignore-on-conflict keeps existing profile).
  const { error: patientError } = await admin
    .from('patients')
    .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true })
  if (patientError) {
    return { ok: false, error: `patients upsert: ${patientError.message}` }
  }

  return { ok: true }
}

/** Delete the users row (patients/reports/... cascade via FK). */
export async function deprovisionUser(
  admin: AdminClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin.from('users').delete().eq('id', userId)
  if (error) return { ok: false, error: `users delete: ${error.message}` }
  return { ok: true }
}
