import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { chatWithAI, chatWithAIStream } from '@/lib/ai/chat'
import { chatLimiter } from '@/lib/rate-limit'
import { applyRateLimit, apiError } from '@/lib/api-helpers'
import { chatMessageSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { getUserSubscription } from '@/lib/data/subscriptions'
import { countChatMessagesSentToday, FREE_CHAT_DAILY_LIMIT } from '@/lib/data/chat'

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const { userId } = await auth()

    // Rate limit: 20 req/min per user
    const rateLimited = applyRateLimit(req, chatLimiter, userId)
    if (rateLimited) return rateLimited

    if (!userId) return apiError('Unauthorized', 401)

    // Free-tier daily message cap (advertised plan limit).
    const tier = await getUserSubscription(userId)
    if (tier === 'free') {
      const sentToday = await countChatMessagesSentToday()
      if (sentToday >= FREE_CHAT_DAILY_LIMIT) {
        return apiError(
          `You've used all ${FREE_CHAT_DAILY_LIMIT} free messages for today. Upgrade to Pro for unlimited AI chat.`,
          403
        )
      }
    }

    // Validate input with Zod
    const body = await req.json()
    const parsed = chatMessageSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    }

    const { message, history, image } = parsed.data

    // Stream when there's no image (text-only messages)
    if (!image) {
      const streamResult = await chatWithAIStream(message, history)

      if ('error' in streamResult) {
        logger.error({
          route: '/api/chat',
          userId,
          err: streamResult.error,
          durationMs: Date.now() - start,
        }, 'Chat stream failed')
        return apiError(streamResult.error)
      }

      logger.info({
        route: '/api/chat',
        userId,
        hasImage: false,
        streaming: true,
        durationMs: Date.now() - start,
      }, 'Chat stream started')

      return new Response(streamResult, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    // Non-streaming for image messages
    const result = await chatWithAI(message, history, image)

    logger.info({
      route: '/api/chat',
      userId,
      hasImage: true,
      streaming: false,
      ok: result.ok,
      durationMs: Date.now() - start,
    }, 'Chat request completed')

    return Response.json(result)
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/chat',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Chat request failed')
    return apiError(err instanceof Error ? err.message : 'Chat failed')
  }
}
