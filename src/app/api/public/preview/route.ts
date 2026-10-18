import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { normalizeReportAnalysis } from '@/lib/reports/report-analysis'

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

    const analysis = normalizeReportAnalysis({
      summaryEnglish: data.summary_english ?? data.summary,
      summaryHinglish: data.summary_hinglish,
      labResults: data.lab_results,
      medications: data.medications,
      conditions: data.conditions,
      extractedVitals: data.extracted_vitals,
      questionsForDoctor: data.questions_for_doctor,
    })

    return NextResponse.json({
      fileName: data.file_name,
      summary: analysis.summary,
      summaryEnglish: analysis.summaryEnglish,
      summaryHinglish: analysis.summaryHinglish,
      labResults: analysis.labResults,
      medications: analysis.medications,
      conditions: analysis.conditions,
      extractedVitals: analysis.extractedVitals,
      questionsForDoctor: analysis.questionsForDoctor,
      medicalDisclaimer: analysis.medicalDisclaimer,
      createdAt: data.created_at,
    }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  } catch (err) {
    logger.error({ route: '/api/public/preview', err: err instanceof Error ? err.message : String(err) }, 'Preview fetch failed')
    return NextResponse.json({ error: 'Failed to load preview' }, { status: 500 })
  }
}
