import { NextResponse } from 'next/server'
import { getFamilyMembers } from '@/lib/data/family'
import { apiError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const members = await getFamilyMembers()
    logger.debug({ route: '/api/family/members', count: members.length }, 'Family members listed')
    return NextResponse.json({ members })
  } catch (err) {
    logger.error({
      route: '/api/family/members',
      err: err instanceof Error ? err.message : String(err),
    }, 'Failed to fetch members')
    return apiError(err instanceof Error ? err.message : 'Failed to fetch members')
  }
}
