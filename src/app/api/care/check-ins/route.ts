import { NextRequest, NextResponse } from 'next/server'
import { auditCareRead, careError, requireCaregiver, requestIp } from '@/lib/care/api'
import { parseNaturalLanguageCheckIn } from '@/lib/care/check-in'

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' }

async function authorizedRecipient(db: any, userId: string, recipientId: string) {
  const { data: recipient, error: recipientError } = await db
    .from('care_recipients')
    .select('id, full_name')
    .eq('id', recipientId)
    .eq('caregiver_id', userId)
    .maybeSingle()

  if (recipientError || !recipient) return { error: 'Care profile not found', status: 404 as const }

  const { data: consent, error: consentError } = await db
    .from('care_consents')
    .select('status, accepted_at, revoked_at, created_at')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (consentError) return { error: 'Unable to verify consent', status: 500 as const }
  if (consent?.status !== 'active' || !consent.accepted_at || consent.revoked_at) {
    return { error: 'Active parent consent is required before check-ins or health trends can be accessed.', status: 403 as const }
  }

  return { recipient }
}

export async function GET(request: NextRequest) {
  const { userId, db, response } = await requireCaregiver()
  if (response) return response

  const recipientId = request.nextUrl.searchParams.get('recipientId')?.trim()
  if (!recipientId) return careError('recipientId is required')

  try {
    const access = await authorizedRecipient(db, userId, recipientId)
    if ('error' in access) return careError(access.error, access.status)

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const ip = requestIp(request)
    await auditCareRead(db, userId, recipientId, 'care_vitals', ip)

    const { data, error } = await db
      .from('care_vitals')
      .select('id, vital_type, systolic, diastolic, glucose_mg_dl, weight_kg, measured_at')
      .eq('recipient_id', recipientId)
      .gte('measured_at', since)
      .order('measured_at', { ascending: true })
      .limit(500)

    if (error) return careError('Unable to load check-in trends', 500)
    return NextResponse.json({ recipient: access.recipient, readings: data ?? [] }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Unable to load check-in trends' }, { status: 500, headers: NO_STORE })
  }
}

export async function POST(request: NextRequest) {
  const { userId, db, response } = await requireCaregiver()
  if (response) return response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return careError('Invalid JSON body')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return careError('Invalid request body')

  const input = body as Record<string, unknown>
  const recipientId = typeof input.recipientId === 'string' ? input.recipientId.trim() : ''
  const text = typeof input.text === 'string' ? input.text.trim() : ''
  if (!recipientId) return careError('recipientId is required')
  if (!text || text.length > 500) return careError('Enter a check-in of up to 500 characters')

  let parsed
  try {
    parsed = parseNaturalLanguageCheckIn(text)
  } catch (error) {
    return careError(error instanceof Error ? error.message : 'Please check the readings and try again.')
  }
  if (parsed.unsupported) {
    return careError('No supported reading found. Try “BP 120/80, sugar 110, weight 65 kg”.')
  }

  try {
    const access = await authorizedRecipient(db, userId, recipientId)
    if ('error' in access) return careError(access.error, access.status)

    const rows = parsed.readings.map((reading) => ({
      ...reading,
      recipient_id: recipientId,
      recorded_by: userId,
      measured_at: new Date().toISOString(),
    }))
    const { data, error } = await db
      .from('care_vitals')
      .insert(rows)
      .select('id, vital_type, systolic, diastolic, glucose_mg_dl, weight_kg, measured_at')

    if (error || !data) return careError('Unable to save this check-in. Please try again.', 500)

    const { error: auditError } = await db.from('care_audit_logs').insert(
      data.map((reading: { id: string }) => ({
        actor_id: userId,
        recipient_id: recipientId,
        action: 'CREATE',
        resource: 'care_vitals',
        record_id: reading.id,
        ip_address: requestIp(request),
      }))
    )

    if (auditError) {
      await db.from('care_vitals').delete().in('id', data.map((reading: { id: string }) => reading.id)).eq('recipient_id', recipientId)
      return careError('The audit record could not be saved, so this check-in was rolled back.', 500)
    }

    return NextResponse.json({ saved: data.length, readings: data }, { status: 201, headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'Unable to save this check-in' }, { status: 500, headers: NO_STORE })
  }
}
