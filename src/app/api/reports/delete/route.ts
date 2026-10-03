import { NextRequest, NextResponse } from 'next/server'
import { deleteReport } from '@/lib/data/reports'
import { apiError } from '@/lib/api-helpers'
import { reportDeleteSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'

export async function DELETE(req: NextRequest) {
  const start = Date.now()
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return apiError('No id', 400)

    const parsed = reportDeleteSchema.safeParse({ id })
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    }

    const ok = await deleteReport(parsed.data.id)
    const durationMs = Date.now() - start
    logger.info({ route: '/api/reports/delete', reportId: id, ok, durationMs }, 'Report deleted')
    return NextResponse.json({ ok })
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/reports/delete',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Report delete failed')
    return apiError(err instanceof Error ? err.message : 'Delete failed')
  }
}
