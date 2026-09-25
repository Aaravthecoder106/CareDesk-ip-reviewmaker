import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { fromUserResource, provisionUser } from '@/lib/data/provisioning'
import { GUEST_SESSION_TOKEN_COOKIE, GUEST_SESSION_TOKEN_HEADER, isGuestSessionId } from '@/lib/guest-session'
import { logger } from '@/lib/logger'

type GuestAnalysis = {
  summary?: string
  healthScore?: number
  insights?: string[]
  labResults?: Array<{ test_name: string; value: number | null; unit: string | null; flag: string | null }>
  medications?: Array<{ name: string; dose: string | null; frequency: string | null }>
  conditions?: Array<{ name: string; status: string | null }>
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Sign in before saving your report.' }, { status: 401 })
    const body = await req.json() as { sessionId?: string }
    if (!isGuestSessionId(body.sessionId)) return NextResponse.json({ error: 'Invalid guest session.' }, { status: 400 })
    const token = req.headers.get(GUEST_SESSION_TOKEN_HEADER) || req.cookies.get(GUEST_SESSION_TOKEN_COOKIE)?.value
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return NextResponse.json({ error: 'Guest session expired.' }, { status: 401 })

    const admin = createAdminSupabaseClient()
    const { data: guest, error: guestError } = await admin
      .from('guest_sessions')
      .select('id, session_id, token_hash, report_storage_path, report, analysis, analysis_status, expires_at, migrated_user_id')
      .eq('session_id', body.sessionId)
      .eq('token_hash', hashToken(token))
      .is('migrated_user_id', null)
      .maybeSingle()
    if (guestError || !guest) return NextResponse.json({ error: 'Guest analysis was not found or already saved.' }, { status: 404 })
    if (guest.analysis_status !== 'ready' || new Date(guest.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: 'This guest analysis has expired or is not ready.' }, { status: 410 })

    const clerkUser = await currentUser()
    if (!clerkUser) return NextResponse.json({ error: 'Your account session expired.' }, { status: 401 })
    const provisioned = await provisionUser(admin, fromUserResource(clerkUser))
    if (!provisioned.ok) return NextResponse.json({ error: 'Your account is still being prepared. Please try again.' }, { status: 503 })

    const report = guest.report as { fileName?: string; mimeType?: string; storagePath?: string | null } | null
    const analysis = (guest.analysis || {}) as GuestAnalysis
    const fileName = report?.fileName || 'Guest report'
    const oldPath = guest.report_storage_path || report?.storagePath || null
    const filePath = `${userId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    if (!oldPath) return NextResponse.json({ error: 'The original report file was not available to save.' }, { status: 503 })
    if (!oldPath.startsWith('guest-uploads/')) return NextResponse.json({ error: 'Invalid guest file path.' }, { status: 400 })
    if (oldPath) {
      const { error: moveError } = await admin.storage.from('reports').move(oldPath, filePath)
      if (moveError) return NextResponse.json({ error: 'The report could not be saved to your account.' }, { status: 503 })
    }

    const { data: reportRow, error: reportError } = await admin.from('reports').insert({
      patient_id: userId,
      title: fileName.replace(/\.[^.]+$/, ''),
      file_path: filePath,
      mime_type: report?.mimeType || null,
      ai_summary: analysis.summary || null,
      status: 'ready',
    }).select('id').single()
    if (reportError || !reportRow) {
      await admin.storage.from('reports').remove([filePath])
      return NextResponse.json({ error: 'The report could not be added to your account.' }, { status: 503 })
    }

    const labs = Array.isArray(analysis.labResults) ? analysis.labResults.filter((lab) => lab.test_name) : []
    const meds = Array.isArray(analysis.medications) ? analysis.medications.filter((med) => med.name) : []
    const conditions = Array.isArray(analysis.conditions) ? analysis.conditions.filter((condition) => condition.name) : []
    if (labs.length) {
      const { error: labError } = await admin.from('lab_results').insert(labs.map((lab) => ({ report_id: reportRow.id, patient_id: userId, test_name: lab.test_name, value: lab.value, unit: lab.unit, flag: lab.flag })))
      if (labError) return NextResponse.json({ error: 'The report analysis could not be saved.' }, { status: 503 })
    }
    if (meds.length) {
      const { error: medError } = await admin.from('medications').insert(meds.map((med) => ({ patient_id: userId, name: med.name, dose: med.dose, frequency: med.frequency })))
      if (medError) return NextResponse.json({ error: 'The report analysis could not be saved.' }, { status: 503 })
    }
    if (conditions.length) {
      const { error: conditionError } = await admin.from('conditions').insert(conditions.map((condition) => ({ patient_id: userId, name: condition.name, status: condition.status })))
      if (conditionError) return NextResponse.json({ error: 'The report analysis could not be saved.' }, { status: 503 })
    }
    const { error: migrateError } = await admin.from('guest_sessions').update({ migrated_user_id: userId, report_storage_path: filePath }).eq('id', guest.id).is('migrated_user_id', null)
    if (migrateError) return NextResponse.json({ error: 'The report was copied but migration could not be finalized.' }, { status: 503 })
    return NextResponse.json({ ok: true, reportId: reportRow.id, redirect: `/dashboard/reports?report=${reportRow.id}` })
  } catch (error) {
    logger.error({ route: '/api/public/migrate', err: error instanceof Error ? error.message : String(error) }, 'Guest migration failed')
    return NextResponse.json({ error: 'We could not save your report. Please try again.' }, { status: 500 })
  }
}
