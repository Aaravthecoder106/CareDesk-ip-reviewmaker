import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getReport, getReportUrl } from '@/lib/data/reports'
import { logAudit, requestIp } from '@/lib/data/audit'
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

    const report = await getReport(parsed.data.id)

    if (!report) return apiError('Report not found', 404)

    const url = await getReportUrl(report.file_path)
    if (!url) return apiError('Could not generate URL', 500)

    // PHI access trail: who generated a view URL for which report.
    await logAudit({ actorId: userId, action: 'SELECT', table: 'reports', recordId: parsed.data.id, ip: requestIp(req) })

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
