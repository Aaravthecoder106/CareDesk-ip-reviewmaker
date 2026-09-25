import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import {
  GUEST_SESSION_TOKEN_COOKIE,
  GUEST_SESSION_TOKEN_HEADER,
  isGuestSessionId,
} from '@/lib/guest-session'

function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId')
    const legacyToken = req.nextUrl.searchParams.get('token')
    const admin = createAdminSupabaseClient()

    if (sessionId) {
      if (!isGuestSessionId(sessionId)) {
        return NextResponse.json({ error: 'Invalid guest session' }, { status: 400 })
      }

      const token = req.headers.get(GUEST_SESSION_TOKEN_HEADER)
        || req.cookies.get(GUEST_SESSION_TOKEN_COOKIE)?.value
      if (!token || !/^[0-9a-f]{64}$/.test(token)) {
        return NextResponse.json({ error: 'Preview not found or expired' }, { status: 404 })
      }

      const { data, error } = await admin
        .from('guest_sessions')
        .select('session_id, report, analysis, analysis_status, health_score, insights, created_at, expires_at')
        .eq('session_id', sessionId)
        .eq('token_hash', tokenHash(token))
        .maybeSingle()

      if (error || !data) {
        return NextResponse.json({ error: 'Preview not found or expired' }, { status: 404 })
      }
      if (new Date(data.expires_at).getTime() <= Date.now()) {
        return NextResponse.json({ error: 'This preview has expired. Please upload again.' }, { status: 410 })
      }
      if (data.analysis_status !== 'ready' || !data.analysis) {
        return NextResponse.json({ error: 'This analysis is not ready.' }, { status: 409 })
      }

      const analysis = data.analysis as Record<string, unknown>
      const report = data.report as Record<string, unknown>
      return NextResponse.json({
        sessionId: data.session_id,
        fileName: typeof report.fileName === 'string' ? report.fileName : 'Report',
        summary: typeof analysis.summary === 'string' ? analysis.summary : '',
        healthScore: data.health_score,
        insights: data.insights,
        labResults: analysis.labResults || [],
        medications: analysis.medications || [],
        conditions: analysis.conditions || [],
        createdAt: data.created_at,
        expiresAt: data.expires_at,
      })
    }

    if (legacyToken) {
      const { data, error } = await admin
        .from('preview_tokens')
        .select('*')
        .eq('token', legacyToken)
        .maybeSingle()

      if (error || !data) {
        return NextResponse.json({ error: 'Preview not found or expired' }, { status: 404 })
      }
      if (Date.now() - new Date(data.created_at).getTime() > 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: 'This preview has expired. Please upload again.' }, { status: 410 })
      }

      return NextResponse.json({
        fileName: data.file_name,
        summary: data.summary,
        healthScore: null,
        insights: [],
        labResults: data.lab_results,
        medications: data.medications,
        conditions: data.conditions,
        createdAt: data.created_at,
      })
    }

    return NextResponse.json({ error: 'Missing guest session' }, { status: 400 })
  } catch {
    logger.error({ route: '/api/public/preview' }, 'Preview fetch failed')
    return NextResponse.json({ error: 'Failed to load preview' }, { status: 500 })
  }
}
