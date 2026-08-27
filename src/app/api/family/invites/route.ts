import { NextResponse } from 'next/server'
import { getPendingInvites } from '@/lib/data/family'
import { apiError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const invites = await getPendingInvites()
    logger.debug({ route: '/api/family/invites', count: invites.length }, 'Pending invites listed')
    return NextResponse.json({ invites })
  } catch (err) {
    logger.error({
      route: '/api/family/invites',
      err: err instanceof Error ? err.message : String(err),
    }, 'Failed to fetch invites')
    return apiError(err instanceof Error ? err.message : 'Failed to fetch invites')
  }
}
