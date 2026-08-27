import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { regenerateAnalytics } from '@/lib/data/analytics'
import { analysisLimiter } from '@/lib/rate-limit'
import { applyRateLimit, apiError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const rateLimited = applyRateLimit(req, analysisLimiter, userId)
    if (rateLimited) return rateLimited

    const result = await regenerateAnalytics()
    const durationMs = Date.now() - start

    logger.info({
      route: '/api/analytics/regenerate',
      userId,
      ok: result.ok,
      durationMs,
    }, 'Analytics regenerated')

    return NextResponse.json(result)
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/analytics/regenerate',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Analytics generation failed')
    return apiError(err instanceof Error ? err.message : 'Analytics generation failed')
  }
}
