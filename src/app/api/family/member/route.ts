import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { confirmFamilyMember, removeFamilyMember } from '@/lib/data/family'
import { apiError } from '@/lib/api-helpers'
import { familyConfirmSchema, familyRemoveSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const body = await req.json()
    const parsed = familyConfirmSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    }

    const result = await confirmFamilyMember(parsed.data.memberId)
    const durationMs = Date.now() - start

    logger.info({
      route: '/api/family/member:POST',
      userId,
      memberId: parsed.data.memberId,
      ok: result.ok,
      durationMs,
    }, 'Family member confirmed')

    return NextResponse.json(result)
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/family/member:POST',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Family confirm failed')
    return apiError(err instanceof Error ? err.message : 'Confirm failed')
  }
}

export async function DELETE(req: NextRequest) {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')
    if (!memberId) return apiError('No memberId', 400)

    const parsed = familyRemoveSchema.safeParse({ memberId })
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    }

    const ok = await removeFamilyMember(parsed.data.memberId)
    const durationMs = Date.now() - start

    logger.info({
      route: '/api/family/member:DELETE',
      userId,
      memberId: parsed.data.memberId,
      ok,
      durationMs,
    }, 'Family member removed')

    return NextResponse.json({ ok })
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/family/member:DELETE',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Family remove failed')
    return apiError(err instanceof Error ? err.message : 'Remove failed')
  }
}
