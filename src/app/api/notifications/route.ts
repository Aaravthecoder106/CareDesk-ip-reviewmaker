import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getNotifications, markNotificationRead } from '@/lib/data/family'
import { apiError } from '@/lib/api-helpers'
import { notificationReadSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const notifications = await getNotifications()
    logger.debug({ route: '/api/notifications', count: notifications.length }, 'Notifications listed')
    return NextResponse.json({ notifications })
  } catch (err) {
    logger.error({
      route: '/api/notifications:GET',
      err: err instanceof Error ? err.message : String(err),
    }, 'Failed to fetch notifications')
    return apiError(err instanceof Error ? err.message : 'Failed to fetch notifications')
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const body = await req.json()
    const parsed = notificationReadSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    }

    const ok = await markNotificationRead(parsed.data.id)
    logger.info({ route: '/api/notifications:POST', userId, notificationId: parsed.data.id, ok }, 'Notification marked read')
    return NextResponse.json({ ok })
  } catch (err) {
    logger.error({
      route: '/api/notifications:POST',
      err: err instanceof Error ? err.message : String(err),
    }, 'Failed to mark read')
    return apiError(err instanceof Error ? err.message : 'Failed to mark read')
  }
}
