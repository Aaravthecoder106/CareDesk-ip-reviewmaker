import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'
import crypto from 'crypto'

export async function getFamilyMembers(): Promise<
  (Tables<'family_members'> & { display_name?: string })[]
> {
  const { userId } = await auth()
  if (!userId) return []

  const supabase = await createClerkSupabaseClient()
  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .or(`owner_id.eq.${userId},member_id.eq.${userId}`)

  if (error) throw new Error(`getFamilyMembers: ${error.message}`)
  const links = data || []
  if (links.length === 0) return []

  // Resolve the other side's display name. The "family read linked user"
  // policy only exposes users rows for ACCEPTED links; pending ones stay
  // anonymous by design.
  const otherIds = links.map((l) => (l.owner_id === userId ? l.member_id : l.owner_id))
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name, email')
    .in('id', otherIds)

  const nameOf = new Map(
    (users || []).map((u) => [
      u.id,
      [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || undefined,
    ])
  )

  return links.map((l) => ({
    ...l,
    display_name: nameOf.get(l.owner_id === userId ? l.member_id : l.owner_id),
  }))
}

export async function getPendingInvites(): Promise<Tables<'family_invites'>[]> {
  const { userId } = await auth()
  if (!userId) return []

  const supabase = await createClerkSupabaseClient()
  const { data, error } = await supabase
    .from('family_invites')
    .select('*')
    .eq('owner_id', userId)
    .eq('status', 'pending')

  if (error) throw new Error(`getPendingInvites: ${error.message}`)
  return data || []
}

export async function createFamilyInvite(
  email: string,
  relation?: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const { userId } = await auth()
    if (!userId) return { ok: false, error: 'Not authenticated' }

    const supabase = await createClerkSupabaseClient()
    const token = crypto.randomBytes(32).toString('hex')

    const { error } = await supabase
      .from('family_invites')
      .insert({
        owner_id: userId,
        email,
        relation,
        token,
        status: 'pending',
      })

    if (error) return { ok: false, error: error.message }
    return { ok: true, token }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invite failed' }
  }
}

export async function acceptFamilyInvite(
  token: string
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  try {
    const supabase = await createClerkSupabaseClient()
    const { data, error } = await supabase.rpc('accept_family_invite', { _token: token })

    if (error) return { ok: false, error: error.message }
    return { ok: true, status: (data as Record<string, unknown>)?.status as string || 'pending_owner' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Accept failed' }
  }
}

export async function confirmFamilyMember(
  memberId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClerkSupabaseClient()
    const { error } = await supabase.rpc('confirm_family_member', { _member_id: memberId })

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Confirm failed' }
  }
}

export async function removeFamilyMember(memberId: string): Promise<boolean> {
  const { userId } = await auth()
  if (!userId) return false

  const supabase = await createClerkSupabaseClient()
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('id', memberId)
    .or(`owner_id.eq.${userId},member_id.eq.${userId}`)

  return !error
}

export async function getNotifications(): Promise<Tables<'notifications'>[]> {
  const { userId } = await auth()
  if (!userId) return []

  const supabase = await createClerkSupabaseClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw new Error(`getNotifications: ${error.message}`)
  return data || []
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const { userId } = await auth()
  if (!userId) return false

  const supabase = await createClerkSupabaseClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  return !error
}
