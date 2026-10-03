import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAnalytics, getFamilyAnalytics } from '@/lib/data/analytics'
import { apiError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET() {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const [data, family] = await Promise.all([getAnalytics(), getFamilyAnalytics()])
    const durationMs = Date.now() - start

    logger.debug({
      route: '/api/analytics/data',
      userId,
      hasData: !!data,
      familyCount: family.length,
      durationMs,
    }, 'Analytics data fetched')

    return NextResponse.json({ data: data?.data || null, family })
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/analytics/data',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Failed to fetch analytics')
    return apiError(err instanceof Error ? err.message : 'Failed to fetch analytics')
  }
}
