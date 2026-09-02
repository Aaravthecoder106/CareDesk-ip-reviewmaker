import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { getReportUrl } from '@/lib/data/reports'
import { generateTextWithImages } from '@/lib/ai/gemini'
import { analysisLimiter } from '@/lib/rate-limit'
import { applyRateLimit, apiError } from '@/lib/api-helpers'
import { reportIdSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const rateLimited = applyRateLimit(req, analysisLimiter, userId)
    if (rateLimited) return rateLimited

    const body = await req.json()
    const parsed = reportIdSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    }

    const supabase = await createClerkSupabaseClient()
    const { data: report, error } = await supabase
      .from('reports')
      .select('file_path, mime_type')
      .eq('id', parsed.data.reportId)
      .eq('patient_id', userId)
      .single()

    if (error || !report) return apiError('Report not found', 404)

    const url = await getReportUrl(report.file_path)
    if (!url) return apiError('Could not get file URL', 500)

    const response = await fetch(url)
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const prompt = `Analyze this medical report image. Extract all visible text, lab values, diagnoses, and medications. Provide a clear summary.`

    const result = await generateTextWithImages(prompt, [
      { data: base64, mimeType: report.mime_type || 'image/jpeg' },
    ])

    const durationMs = Date.now() - start
    logger.info({
      route: '/api/reports/analyze-image',
      userId,
      reportId: parsed.data.reportId,
      durationMs,
    }, 'Image analysis completed')

    return NextResponse.json({ ok: true, summary: result })
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/reports/analyze-image',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Image analysis failed')
    return apiError(err instanceof Error ? err.message : 'Image analysis failed')
  }
}
