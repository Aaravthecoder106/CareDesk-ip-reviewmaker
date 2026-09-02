import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { verifyRazorpaySignature } from '@/lib/razorpay'
import { upsertSubscription } from '@/lib/data/subscriptions'
import { logger } from '@/lib/logger'

/**
 * POST /api/razorpay/verify
 * Verifies Razorpay payment and activates subscription.
 * Called after successful payment from the client-side Razorpay checkout.
 */
export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
    }

    // Verify signature
    const isValid = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    })

    if (!isValid) {
      logger.warn({ route: '/api/razorpay/verify', userId, razorpay_order_id }, 'Invalid payment signature')
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    // Activate subscription
    const now = new Date()
    const periodEnd = new Date(now)
    if (plan.includes('monthly')) {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    }

    await upsertSubscription({
      userId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      plan,
      status: 'active',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
    })

    const durationMs = Date.now() - start
    logger.info({ route: '/api/razorpay/verify', userId, plan, razorpay_payment_id, durationMs }, 'Payment verified and subscription activated')

    return NextResponse.json({ ok: true, plan, expiresAt: periodEnd.toISOString() })
  } catch (error) {
    const durationMs = Date.now() - start
    logger.error({ route: '/api/razorpay/verify', durationMs, err: error instanceof Error ? error.message : String(error) }, 'Payment verification failed')
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 })
  }
}
