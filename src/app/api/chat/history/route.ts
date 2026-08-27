import { NextResponse } from 'next/server'
import { getChatHistory } from '@/lib/data/chat'
import { apiError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const messages = await getChatHistory()
    logger.debug({ route: '/api/chat/history', count: messages.length }, 'Chat history fetched')
    return NextResponse.json({ messages })
  } catch (err) {
    logger.error({
      route: '/api/chat/history',
      err: err instanceof Error ? err.message : String(err),
    }, 'Failed to fetch history')
    return apiError(err instanceof Error ? err.message : 'Failed to fetch history')
  }
}
