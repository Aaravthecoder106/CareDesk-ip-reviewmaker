'use client'

import { createClient, SupabaseClient } from '@supabase/supabase-js'


let cachedClient: SupabaseClient | null = null

/**
 * Get a browser-side Supabase client for direct file uploads.
 * Pass the Clerk session token and userId from useAuth() in the calling component.
 */
export function getUploadClient(getToken: () => Promise<string | null>): SupabaseClient {
  if (cachedClient) return cachedClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing')
  }

  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    async accessToken() {
      return (await getToken()) ?? null
    },
  })

  return cachedClient
}
