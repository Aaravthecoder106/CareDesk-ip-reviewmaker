import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

export async function getChatHistory(limit = 50): Promise<Tables<'chat_messages'>[]> {
  const { userId } = await auth()
  if (!userId) return []

  const supabase = await createClerkSupabaseClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`getChatHistory: ${error.message}`)
  return data || []
}

export async function clearChatHistory(): Promise<boolean> {
  const { userId } = await auth()
  if (!userId) return false

  const supabase = await createClerkSupabaseClient()
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('user_id', userId)

  return !error
}
