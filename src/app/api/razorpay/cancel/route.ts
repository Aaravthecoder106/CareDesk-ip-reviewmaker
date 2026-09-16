import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { cancelSubscription, getUserSubscription } from '@/lib/data/subscriptions'
import { logger } from '@/lib/logger'

/**
 * POST /api/razorpay/cancel
 * Cancels the user's active subscription and downgrades to free tier.
 * Note: This handles app-side cancellation only. For Razorpay subscriptions
 * (recurring payments), you should also cancel via Razorpay API if using
 * auto-debit / subscriptions API.
 */
export async function POST() {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentTier = await getUserSubscription(userId)
    if (currentTier === 'free') {
      return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 400 })
    }

    await cancelSubscription(userId)

    const durationMs = Date.now() - start
    logger.info({ route: '/api/razorpay/cancel', userId, previousTier: currentTier, durationMs }, 'Subscription canceled')

    return NextResponse.json({ ok: true, tier: 'free' })
  } catch (error) {
    const durationMs = Date.now() - start
    logger.error({ route: '/api/razorpay/cancel', durationMs, err: error instanceof Error ? error.message : String(error) }, 'Cancel subscription failed')
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
