import type { UserJSON, User } from '@clerk/nextjs/server'
import type { TablesInsert } from '@/lib/supabase/types'

/**
 * Pure Clerk -> row mapping helpers. No side effects and no `server-only`
 * import, so this module is unit-testable in a plain Node process.
 *
 * Two Clerk representations feed the same core: the webhook delivers a
 * snake_case `UserJSON`, while server-side `currentUser()` returns a camelCase
 * `User` resource. Both normalize to `NormalizedClerkUser` first, so the
 * mapping exists once and neither path relies on an unsafe cast.
 */

export type NormalizedClerkUser = {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
}

/** Normalize a webhook UserJSON (snake_case) payload. */
export function fromUserJSON(user: UserJSON): NormalizedClerkUser {
  const primary = user.email_addresses.find(
    (e) => e.id === user.primary_email_address_id,
  )
  const email =
    primary?.email_address ?? user.email_addresses[0]?.email_address ?? null
  return {
    id: user.id,
    email,
    firstName: user.first_name,
    lastName: user.last_name,
  }
}

/** Normalize a server `currentUser()` User resource (camelCase). */
export function fromUserResource(user: User): NormalizedClerkUser {
  const primary = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  )
  const email =
    primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null
  return {
    id: user.id,
    email,
    firstName: user.firstName,
    lastName: user.lastName,
  }
}

/** Map a normalized Clerk user to a public.users insert row. */
export function mapToUserRow(
  user: NormalizedClerkUser,
): TablesInsert<'users'> | null {
  if (!user.email) return null
  return {
    id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
  }
}
