/**
 * Shared helpers for API route handlers.
 */
import { NextRequest, NextResponse } from 'next/server'
import type { rateLimit } from '@/lib/rate-limit'

/** Extract a rate-limit key from the request (userId preferred, falls back to IP). */
export function rateLimitKey(req: NextRequest, userId?: string | null): string {
  if (userId) return `u:${userId}`
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? '127.0.0.1'
  return `ip:${ip}`
}

/** Apply a rate limiter and return a 429 response if exceeded, or null if ok. */
export function applyRateLimit(
  req: NextRequest,
  limiter: ReturnType<typeof rateLimit>,
  userId?: string | null,
): NextResponse | null {
  const key = rateLimitKey(req, userId)
  const result = limiter.check(key)
  if (!result.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
          'X-RateLimit-Limit': String(limiter.check(key).remaining), // informational
        },
      },
    )
  }
  return null
}

/** Standard JSON error response. */
export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

/** Standard JSON success response. */
export function apiOk(data: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...data })
}
