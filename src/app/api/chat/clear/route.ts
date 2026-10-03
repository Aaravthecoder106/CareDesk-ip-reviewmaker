import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clearChatHistory } from '@/lib/data/chat'
import { apiError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function DELETE() {
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const ok = await clearChatHistory()
    logger.info({ route: '/api/chat/clear', userId, ok }, 'Chat history cleared')
    return NextResponse.json({ ok })
  } catch (err) {
    logger.error({
      route: '/api/chat/clear',
      err: err instanceof Error ? err.message : String(err),
    }, 'Clear failed')
    return apiError(err instanceof Error ? err.message : 'Clear failed')
  }
}
