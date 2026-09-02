import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { setLibraryPassword, verifyLibraryPassword, removeLibraryPassword, hasLibraryPassword } from '@/lib/data/library'
import { apiLimiter } from '@/lib/rate-limit'
import { applyRateLimit, apiError } from '@/lib/api-helpers'
import { libraryPasswordSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    // Rate limit password operations
    const rateLimited = applyRateLimit(req, apiLimiter, userId)
    if (rateLimited) return rateLimited

    const body = await req.json()
    const parsed = libraryPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    }

    const { action, password } = parsed.data

    switch (action) {
      case 'status': {
        const locked = await hasLibraryPassword()
        return NextResponse.json({ ok: true, locked })
      }
      case 'set': {
        if (!password) return apiError('No password', 400)
        const result = await setLibraryPassword(password)
        const durationMs = Date.now() - start
        logger.info({ route: '/api/library/password', userId, action: 'set', ok: result.ok, durationMs }, 'Library password set')
        return NextResponse.json(result)
      }
      case 'verify': {
        const ok = await verifyLibraryPassword(password || '')
        const durationMs = Date.now() - start
        logger.info({ route: '/api/library/password', userId, action: 'verify', ok, durationMs }, 'Library password verified')
        return NextResponse.json({ ok })
      }
      case 'remove': {
        const ok = await removeLibraryPassword()
        const durationMs = Date.now() - start
        logger.info({ route: '/api/library/password', userId, action: 'remove', ok, durationMs }, 'Library password removed')
        return NextResponse.json({ ok })
      }
      default:
        return apiError('Invalid action', 400)
    }
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/library/password',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Library password operation failed')
    return apiError(err instanceof Error ? err.message : 'Library password operation failed')
  }
}
