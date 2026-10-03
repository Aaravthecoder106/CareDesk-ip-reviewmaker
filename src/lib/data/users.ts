import 'server-only'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { provisionUser, fromUserResource } from '@/lib/data/provisioning'
import type { Tables } from '@/lib/supabase/types'

/**
 * Server-side data-access layer for the current user's identity.
 *
 * Reads go through the RLS-scoped Clerk client (createClerkSupabaseClient), so
 * every query is constrained to the caller by the Phase-0 policies — the DAL
 * never has to add `.eq('id', userId)` for security, only for shape.
 */

/**
 * Read the current user's public.users row (RLS-scoped).
 * Returns null if unauthenticated or the row has not synced yet.
 */
export async function getCurrentUser(): Promise<Tables<'users'> | null> {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = await createClerkSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(`getCurrentUser: ${error.message}`)
  return data
}

/** Read the current user's patient profile (RLS-scoped). */
export async function getCurrentPatient(): Promise<Tables<'patients'> | null> {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = await createClerkSupabaseClient()
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(`getCurrentPatient: ${error.message}`)
  return data
}

/**
 * Guarantee the current user is provisioned, then return their users row.
 *
 * Self-heal for the webhook race: if a freshly-signed-up user reaches the app
 * before Clerk's user.created webhook lands, the users row won't exist yet.
 * This provisions it on demand (service-role, idempotent) using the live Clerk
 * profile, then reads it back through RLS. Safe to call on every authenticated
 * entry point; it's a no-op once the row exists.
 */
export async function ensureCurrentUserProvisioned(): Promise<Tables<'users'> | null> {
  const existing = await getCurrentUser()
  if (existing) return existing

  const clerkUser = await currentUser()
  if (!clerkUser) return null

  const admin = createAdminSupabaseClient()
  const result = await provisionUser(admin, fromUserResource(clerkUser))
  if (!result.ok) throw new Error(`ensureCurrentUserProvisioned: ${result.error}`)

  return getCurrentUser()
}
