import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { analyzeReport } from '@/lib/ai/analyze-report'
import { analysisLimiter } from '@/lib/rate-limit'
import { applyRateLimit, apiError } from '@/lib/api-helpers'
import { reportIdSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    // Rate limit: 5 re-analyses per 5 min
    const rateLimited = applyRateLimit(req, analysisLimiter, userId)
    if (rateLimited) return rateLimited

    const body = await req.json()
    const parsed = reportIdSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    }

    const { reportId } = parsed.data
    const supabase = await createClerkSupabaseClient()
    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('patient_id', userId)
      .single()

    if (error || !report) return apiError('Report not found', 404)

    await supabase.from('reports').update({ status: 'processing' }).eq('id', reportId)

    const result = await analyzeReport(report.id, report.file_path, report.mime_type || 'application/pdf')

    const durationMs = Date.now() - start
    logger.info({
      route: '/api/reports/analyze',
      userId,
      reportId,
      ok: result.ok,
      durationMs,
    }, 'Report re-analyzed')

    return NextResponse.json(result)
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/reports/analyze',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Report analysis failed')
    return apiError(err instanceof Error ? err.message : 'Analysis failed')
  }
}
