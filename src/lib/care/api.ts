import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function requireCaregiver() {
  const { userId } = await auth()
  if (!userId) return { userId: null, db: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  // Care pilot tables are introduced by migration 0008 and are not yet in the hand-maintained generated schema.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { userId, db: createAdminSupabaseClient() as any, response: null }
}

export function careError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function auditCareRead(db: any, actorId: string, recipientId: string, resource: string, ip: string | null) {
  const { error } = await db.from('care_audit_logs').insert({ actor_id: actorId, recipient_id: recipientId, action: 'READ', resource, ip_address: ip })
  if (error) throw new Error('Unable to record required audit entry')
}

export function requestIp(request: Request) {
  const raw = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return raw && /^[0-9a-fA-F:.]+$/.test(raw) ? raw : null
}
