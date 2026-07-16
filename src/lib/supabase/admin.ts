import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/env'
import type { Database } from './types'

/**
 * Supabase client authenticated with the service-role key.
 *
 * Bypasses Row Level Security entirely — use ONLY in trusted server-side code
 * that has already authorized the caller. Intended for:
 *   - the Clerk -> public.users sync webhook (row creation/deletion)
 *   - the AI pipeline writing to service-role-only tables
 *     (report_embeddings, lab_results, medications, conditions, audit_logs)
 *
 * NEVER import this into a client component or expose the returned client to
 * the browser. The `server-only` import makes such a mistake a build error.
 */
export function createAdminSupabaseClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
