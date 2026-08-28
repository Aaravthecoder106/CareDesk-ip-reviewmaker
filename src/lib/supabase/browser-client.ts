'use client'

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { useAuth } from '@clerk/nextjs'
import { useRef } from 'react'

/**
 * Hook to get a browser-side Supabase client authenticated with the current
 * Clerk user. Used for direct file uploads that bypass Vercel's body size limit.
 */
export function useSupabaseUpload() {
  const { getToken, userId } = useAuth()
  const clientRef = useRef<SupabaseClient | null>(null)

  async function getClient(): Promise<SupabaseClient> {
    if (clientRef.current) return clientRef.current

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing')
    }

    clientRef.current = createClient(supabaseUrl, supabaseAnonKey, {
      async accessToken() {
        return (await getToken()) ?? null
      },
    })

    return clientRef.current
  }

  return { getClient, userId }
}
