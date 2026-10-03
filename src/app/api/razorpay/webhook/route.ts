import { NextRequest, NextResponse } from 'next/server'
import { completeRazorpayOrder } from '@/lib/data/subscriptions'
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
 * - subscription.deactivated
 *
 * payment.captured is routed through completeRazorpayOrder() (server-side
 * razorpay_orders record, idempotent), so it can race the client verify call
 * without double-extending the subscription period.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature')

    if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET === 'placeholder') {
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
        if (!payment?.order_id) break

        const result = await completeRazorpayOrder(payment.order_id, payment.id)
        if (result.ok) {
          logger.info({ route: '/api/razorpay/webhook', orderId: payment.order_id, plan: result.plan, alreadyCompleted: result.alreadyCompleted }, 'Webhook activated subscription')
        } else {
          logger.warn({ route: '/api/razorpay/webhook', orderId: payment.order_id, err: result.error }, 'Webhook payment has no known order')
        }
        break
      }

      case 'payment.failed': {
        // Log the failure with whatever identifiers the payload carries.
        // Razorpay puts the failure reason at payload.payment.entity.
        const payment = event.payload.payment?.entity
        if (!payment?.id) break
        logger.warn(
          {
            route: '/api/razorpay/webhook',
            orderId: payment.order_id,
            paymentId: payment.id,
            reason: payment.error_description || payment.error_code,
          },
          'Payment failed'
        )
        break
      }

      case 'subscription.deactivated': {
        // CareDesk uses one-time orders, not Razorpay subscription plans, so
        // this event should never arrive legitimately. If it does (dashboard
        // misconfiguration or a forged-but-signed payload), log it loudly but
        // do NOT auto-cancel the user's plan: the notes on a subscription
        // entity are attacker-untrusted for one-time-order flows.
        const subscription = event.payload.subscription?.entity
        logger.warn(
          {
            route: '/api/razorpay/webhook',
            subscriptionId: subscription?.id,
            reason: 'unexpected subscription.deactivated event (CareDesk uses one-time orders)',
          },
          'Ignoring subscription.deactivated'
        )
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error({ route: '/api/razorpay/webhook', err: error instanceof Error ? error.message : String(error) }, 'Webhook handler error')
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
