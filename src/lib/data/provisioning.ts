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

  // H2: never re-create a user that was deleted. A late user.created/updated
  // arriving after user.deleted (Clerk retries with backoff) must not
  // resurrect the account. Acknowledge and no-op.
  const { data: tombstone, error: tombstoneError } = await admin
    .from('deleted_users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (tombstoneError) {
    return { ok: false, error: `deleted_users check: ${tombstoneError.message}` }
  }
  if (tombstone) return { ok: true }

  const { error: userError } = await admin
    .from('users')
    .upsert(row, { onConflict: 'id' })
  if (userError) {
    // C1: the upsert conflict target is `id`, but `email` carries its own
    // UNIQUE constraint. A collision there raises 23505, which onConflict:'id'
    // cannot absorb. Clerk guarantees at most one LIVE user per email, so the
    // colliding row belongs to a defunct id (e.g. a delete whose user.deleted
    // was dropped, then re-signup with a new id + same email). Reconcile by
    // removing the stale row (cascades its data), then retry once.
    if (userError.code !== '23505') {
      return { ok: false, error: `users upsert: ${userError.message}` }
    }
    const { error: reconcileError } = await admin
      .from('users')
      .delete()
      .eq('email', row.email)
      .neq('id', row.id)
    if (reconcileError) {
      return { ok: false, error: `users email reconcile: ${reconcileError.message}` }
    }
    const { error: retryError } = await admin
      .from('users')
      .upsert(row, { onConflict: 'id' })
    if (retryError) {
      return { ok: false, error: `users upsert retry: ${retryError.message}` }
    }
  }

  // Idempotent patient provisioning (ignore-on-conflict keeps existing profile).
  const { error: patientError } = await admin
    .from('patients')
    .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true })
  if (patientError) {
    return { ok: false, error: `patients upsert: ${patientError.message}` }
  }

  return { ok: true }
}

/**
 * Delete the users row (patients/reports/... cascade via FK), remove the user's
 * uploaded files, and record a deletion tombstone.
 *
 * H1: storage objects under `<userId>/` have no FK to the DB, so a row cascade
 * leaves uploaded medical files (PHI) orphaned. They are explicitly removed.
 * H2: the tombstone blocks a late user.created/updated from resurrecting the id.
 */
export async function deprovisionUser(
  admin: AdminClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Remove the caller's storage objects first (reports bucket, `<userId>/...`).
  // Best-effort pagination; a storage failure must surface so Clerk retries.
  const storageError = await removeUserStorage(admin, userId)
  if (storageError) {
    return { ok: false, error: `storage cleanup: ${storageError}` }
  }

  const { error } = await admin.from('users').delete().eq('id', userId)
  if (error) return { ok: false, error: `users delete: ${error.message}` }

  // Record the tombstone AFTER the row is gone, so a resurrection can't slip in.
  const { error: tombstoneError } = await admin
    .from('deleted_users')
    .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })
  if (tombstoneError) {
    return { ok: false, error: `tombstone write: ${tombstoneError.message}` }
  }

  return { ok: true }
}

/**
 * Remove every object the user owns in the private `reports` bucket. Objects are
 * keyed `<clerk_user_id>/...`; list is paginated (Supabase caps a page at 100).
 * Returns an error string on failure, or null on success.
 */
async function removeUserStorage(
  admin: AdminClient,
  userId: string,
): Promise<string | null> {
  const bucket = admin.storage.from('reports')
  const pageSize = 100
  let offset = 0

  for (;;) {
    const { data: objects, error: listError } = await bucket.list(userId, {
      limit: pageSize,
      offset,
    })
    if (listError) return listError.message
    if (!objects || objects.length === 0) break

    const paths = objects.map((o) => `${userId}/${o.name}`)
    const { error: removeError } = await bucket.remove(paths)
    if (removeError) return removeError.message

    if (objects.length < pageSize) break
    offset += pageSize
  }

  return null
}
