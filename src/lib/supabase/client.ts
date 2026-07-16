import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { env } from '@/env'

/**
 * Supabase client authenticated as the current Clerk user (RLS-scoped).
 *
 * Uses Clerk's native third-party-auth integration: supabase-js calls the
 * `accessToken` async callback on every request and forwards the Clerk session
 * token, whose `sub` claim Supabase exposes to RLS via `request.jwt.claims`
 * (read by public.clerk_user_id()).
 *
 * This replaces the deprecated `getToken({ template: 'supabase' })` JWT-template
 * approach, which Clerk has sunset in favour of the native integration.
 *
 * Requires: Clerk dashboard → Integrations → Supabase enabled, and the Clerk
 * issuer registered as a third-party auth provider in the Supabase dashboard.
 *
 * Server-only (calls Clerk's server `auth()`), so use in server components,
 * route handlers, and server actions.
 */
export async function createClerkSupabaseClient() {
  const { getToken } = await auth()

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      async accessToken() {
        return (await getToken()) ?? null
      },
    }
  )
}
