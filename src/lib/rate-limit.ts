/**
 * Lightweight sliding-window rate limiter (in-memory).
 *
 * For single-instance deployments (Vercel serverless, single Node) this is
 * sufficient. For multi-instance / edge deployments swap the store for Redis
 * (Upstash) without changing the public API.
 *
 * Usage in route handlers:
 *   const limiter = rateLimit({ windowMs: 60_000, max: 20 })
 *   const key = userId ?? ip ?? 'anon'
 *   const result = limiter.check(key)
 *   if (!result.ok) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
 */

interface RateLimitEntry {
  timestamps: number[]
}

interface RateLimitOpts {
  /** Sliding window size in milliseconds (default: 60 s) */
  windowMs?: number
  /** Max requests per window (default: 30) */
  max?: number
}

interface CheckResult {
  ok: boolean
  remaining: number
  retryAfterMs: number
}

const store = new Map<string, RateLimitEntry>()

// Periodic cleanup to prevent memory leaks from stale keys.
const CLEANUP_INTERVAL_MS = 60_000
let cleanupTimer: ReturnType<typeof setInterval> | null = null

function startCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      // Remove entries older than 2× the longest window (conservative).
      entry.timestamps = entry.timestamps.filter((t) => now - t < 300_000)
      if (entry.timestamps.length === 0) store.delete(key)
    }
  }, CLEANUP_INTERVAL_MS)
  // Allow Node to exit even if the timer is running.
  if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref()
  }
}

export function rateLimit(opts: RateLimitOpts = {}) {
  const windowMs = opts.windowMs ?? 60_000
  const max = opts.max ?? 30

  startCleanup()

  return {
    check(key: string): CheckResult {
      const now = Date.now()
      const entry = store.get(key) ?? { timestamps: [] }

      // Prune timestamps outside the window.
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

      if (entry.timestamps.length >= max) {
        const oldest = entry.timestamps[0]
        const retryAfterMs = windowMs - (now - oldest)
        return { ok: false, remaining: 0, retryAfterMs }
      }

      entry.timestamps.push(now)
      store.set(key, entry)

      return { ok: true, remaining: max - entry.timestamps.length, retryAfterMs: 0 }
    },
  }
}

// ── Pre-configured limiters ──────────────────────────────────────────────

/** General API: 60 req/min per user/IP */
export const apiLimiter = rateLimit({ windowMs: 60_000, max: 60 })

/** AI Chat: 20 messages/min */
export const chatLimiter = rateLimit({ windowMs: 60_000, max: 20 })

/** Report uploads: 10 per 5 min */
export const uploadLimiter = rateLimit({ windowMs: 300_000, max: 10 })

/** AI analysis (re-analyze): 5 per 5 min */
export const analysisLimiter = rateLimit({ windowMs: 300_000, max: 5 })

/** Library password verification: 5 attempts per 5 min (brute-force guard) */
export const passwordVerifyLimiter = rateLimit({ windowMs: 300_000, max: 5 })
