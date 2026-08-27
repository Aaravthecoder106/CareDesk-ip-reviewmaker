import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { getReportUrl } from '@/lib/data/reports'
import { apiError } from '@/lib/api-helpers'
import { reportPreviewSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return apiError('No id', 400)

    const parsed = reportPreviewSchema.safeParse({ id })
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    }

    const supabase = await createClerkSupabaseClient()
    const { data: report } = await supabase
      .from('reports')
      .select('file_path')
      .eq('id', parsed.data.id)
      .eq('patient_id', userId)
      .single()

    if (!report) return apiError('Report not found', 404)

    const url = await getReportUrl(report.file_path)
    if (!url) return apiError('Could not generate URL', 500)

    const durationMs = Date.now() - start
    logger.debug({ route: '/api/reports/preview', reportId: parsed.data.id, durationMs }, 'Preview URL generated')

    return NextResponse.json({ url })
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/reports/preview',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Preview failed')
    return apiError(err instanceof Error ? err.message : 'Preview failed')
  }
}
