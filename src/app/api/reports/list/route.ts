import { NextResponse } from 'next/server'
import { getReports } from '@/lib/data/reports'
import { apiError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET() {
  const start = Date.now()
  try {
    const reports = await getReports()
    const durationMs = Date.now() - start
    logger.debug({ route: '/api/reports/list', count: reports.length, durationMs }, 'Reports listed')
    return NextResponse.json({ reports })
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/reports/list',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Failed to fetch reports')
    return apiError(err instanceof Error ? err.message : 'Failed to fetch reports')
  }
}
