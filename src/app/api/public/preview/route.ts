import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

/**
 * GET /api/public/preview?token=xxx
 * Returns the analysis data for a guest preview token.
 * Public — no auth required.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { data, error } = await admin
      .from('preview_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Preview not found or expired' }, { status: 404 })
    }

    // Expire after 24 hours
    const createdAt = new Date(data.created_at)
    const ageMs = Date.now() - createdAt.getTime()
    if (ageMs > 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'This preview has expired. Please upload again.' }, { status: 410 })
    }

    return NextResponse.json({
      fileName: data.file_name,
      summary: data.summary,
      labResults: data.lab_results,
      medications: data.medications,
      conditions: data.conditions,
      createdAt: data.created_at,
    })
  } catch (err) {
    logger.error({ route: '/api/public/preview', err: err instanceof Error ? err.message : String(err) }, 'Preview fetch failed')
    return NextResponse.json({ error: 'Failed to load preview' }, { status: 500 })
  }
}
