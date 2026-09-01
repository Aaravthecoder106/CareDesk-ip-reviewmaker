import { NextRequest, NextResponse } from 'next/server'
import { upsertSubscription, cancelSubscription } from '@/lib/data/subscriptions'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

/**
 * POST /api/razorpay/webhook
 * Handles Razorpay webhook events for payment lifecycle.
 * Configure this URL in Razorpay Dashboard: https://your-domain.com/api/razorpay/webhook
 *
 * Events to subscribe to:
 * - payment.captured
 * - payment.failed
 * - subscription.activated
 * - subscription.deactivated
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature')

    if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex')

    if (expectedSignature !== signature) {
      logger.warn({ route: '/api/razorpay/webhook' }, 'Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)
    const eventType = event.event

    logger.info({ route: '/api/razorpay/webhook', eventType }, 'Webhook received')

    switch (eventType) {
      case 'payment.captured': {
        const payment = event.payload.payment?.entity
        if (!payment?.notes?.clerk_user_id) break

        const userId = payment.notes.clerk_user_id
        const plan = payment.notes.plan || 'pro_individual_monthly'

        const now = new Date()
        const periodEnd = new Date(now)
        if (plan.includes('monthly')) {
          periodEnd.setMonth(periodEnd.getMonth() + 1)
        } else {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1)
        }

        await upsertSubscription({
          userId,
          razorpayOrderId: payment.order_id,
          razorpayPaymentId: payment.id,
          plan,
          status: 'active',
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
        })
        break
      }

      case 'payment.failed': {
        const payment = event.payload.payment?.entity
        if (!payment?.notes?.clerk_user_id) break
        logger.warn({ route: '/api/razorpay/webhook', userId: payment.notes.clerk_user_id }, 'Payment failed')
        break
      }

      case 'subscription.deactivated': {
        const subscription = event.payload.subscription?.entity
        if (!subscription?.notes?.clerk_user_id) break
        await cancelSubscription(subscription.notes.clerk_user_id)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error({ route: '/api/razorpay/webhook', err: error instanceof Error ? error.message : String(error) }, 'Webhook handler error')
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
