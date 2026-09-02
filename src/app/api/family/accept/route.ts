import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { acceptFamilyInvite } from '@/lib/data/family'
import { apiError } from '@/lib/api-helpers'
import { familyAcceptSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const body = await req.json()
    const parsed = familyAcceptSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    }

    const result = await acceptFamilyInvite(parsed.data.token)
    const durationMs = Date.now() - start

    logger.info({
      route: '/api/family/accept',
      userId,
      ok: result.ok,
      durationMs,
    }, 'Family invite accepted')

    return NextResponse.json(result)
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/family/accept',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Family accept failed')
    return apiError(err instanceof Error ? err.message : 'Accept failed')
  }
}
