import { NextRequest, NextResponse } from 'next/server'
import { careError, requireCaregiver } from '@/lib/care/api'

export async function GET() {
  const { userId, db, response } = await requireCaregiver()
  if (response) return response
  const { data, error } = await db.from('care_recipients').select('id, full_name, date_of_birth, emergency_contact_name, emergency_contact_phone, created_at, updated_at').eq('caregiver_id', userId).order('created_at', { ascending: false })
  if (error) return careError('Unable to load care recipients', 500)
  return NextResponse.json({ recipients: data ?? [] })
}

export async function POST(request: NextRequest) {
  const { userId, db, response } = await requireCaregiver()
  if (response) return response
  let body: unknown
  try { body = await request.json() } catch { return careError('Invalid JSON body') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return careError('Invalid request body')
  const input = body as Record<string, unknown>
  const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : ''
  if (!fullName || fullName.length > 120) return careError('Name is required and must be at most 120 characters')
  const phone = typeof input.emergency_contact_phone === 'string' ? input.emergency_contact_phone.trim() : null
  if (phone && phone.length > 40) return careError('Emergency contact phone is too long')
  const dob = typeof input.date_of_birth === 'string' && input.date_of_birth ? input.date_of_birth : null
  if (dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob)))) return careError('Date of birth must use YYYY-MM-DD')
  const { data, error } = await db.from('care_recipients').insert({
    caregiver_id: userId,
    full_name: fullName,
    date_of_birth: dob,
    emergency_contact_name: typeof input.emergency_contact_name === 'string' ? input.emergency_contact_name.trim().slice(0, 120) || null : null,
    emergency_contact_phone: phone,
  }).select('id, full_name, date_of_birth, emergency_contact_name, emergency_contact_phone, created_at').single()
  if (error) return careError('Unable to create care recipient', 500)
  const { error: auditError } = await db.from('care_audit_logs').insert({ actor_id: userId, recipient_id: data.id, action: 'CREATE', resource: 'care_recipients', record_id: data.id })
  if (auditError) {
    await db.from('care_recipients').delete().eq('id', data.id).eq('caregiver_id', userId)
    return careError('Could not record audit entry; recipient was not saved', 500)
  }
  return NextResponse.json({ recipient: data }, { status: 201 })
}
