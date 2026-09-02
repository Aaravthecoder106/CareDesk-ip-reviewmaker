import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { getUserSubscription } from '@/lib/data/subscriptions'
import type { Tables } from '@/lib/supabase/types'

/** Free Explorer plan: messages per day and history retention. */
export const FREE_CHAT_DAILY_LIMIT = 5
export const FREE_CHAT_HISTORY_DAYS = 7

export async function getChatHistory(limit = 50): Promise<Tables<'chat_messages'>[]> {
  const { userId } = await auth()
  if (!userId) return []

  const supabase = await createClerkSupabaseClient()

  // Free tier only retains 7 days of history (advertised plan limit).
  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(limit)

  const tier = await getUserSubscription(userId)
  if (tier === 'free') {
    const cutoff = new Date(Date.now() - FREE_CHAT_HISTORY_DAYS * 24 * 60 * 60 * 1000)
    query = query.gte('created_at', cutoff.toISOString())
  }

  const { data, error } = await query
  if (error) throw new Error(`getChatHistory: ${error.message}`)
  return data || []
}

/**
 * Count the messages the current user has sent today (UTC).
 * Used to enforce the free-tier daily chat cap.
 */
export async function countChatMessagesSentToday(): Promise<number> {
  const { userId } = await auth()
  if (!userId) return 0

  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const supabase = await createClerkSupabaseClient()
  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', startOfDay.toISOString())

  return count || 0
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
