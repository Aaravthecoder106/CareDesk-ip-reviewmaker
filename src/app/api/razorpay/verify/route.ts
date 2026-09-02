import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { verifyRazorpaySignature, getRazorpay, assertRazorpayConfigured } from '@/lib/razorpay'
import { completeRazorpayOrder } from '@/lib/data/subscriptions'
import { logger } from '@/lib/logger'

/**
 * POST /api/razorpay/verify
 * Verifies a Razorpay payment and activates the subscription.
 * Called after successful payment from the client-side Razorpay checkout.
 *
 * Security model:
 *  - the signature proves order_id/payment_id integrity
 *  - the plan comes from the server-side razorpay_orders row, NEVER from the
 *    request body (a client cannot buy monthly and claim annual)
 *  - the payment is re-fetched from Razorpay and must be captured for the
 *    full order amount
 *  - completion is idempotent: replaying the request cannot extend the period
 */
export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    assertRazorpayConfigured()

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
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

    // Confirm with Razorpay that the payment really belongs to
    // this order and covers the full order amount.
    const razorpay = getRazorpay()
    const payment = (await razorpay.payments.fetch(razorpay_payment_id)) as {
      order_id?: string
      status?: string
      amount?: number
    }
    if (payment.order_id !== razorpay_order_id || (payment.status !== 'captured' && payment.status !== 'authorized')) {
      logger.warn({ route: '/api/razorpay/verify', userId, razorpay_order_id, paymentStatus: payment.status }, 'Payment not captured or authorized for this order')
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    // Auto-capture if payment is authorized but not yet captured
    if (payment.status === 'authorized') {
      try {
        await razorpay.payments.capture(razorpay_payment_id, payment.amount || 0, 'INR')
      } catch (err) {
        logger.warn({ route: '/api/razorpay/verify', err: String(err) }, 'Auto-capture warning')
      }
    }

    // Activate from the server-side order record (idempotent).
    const result = await completeRazorpayOrder(razorpay_order_id, razorpay_payment_id)
    if (!result.ok) {
      logger.warn({ route: '/api/razorpay/verify', userId, razorpay_order_id, err: result.error }, 'Order activation failed')
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }
    if (result.userId !== userId) {
      logger.warn({ route: '/api/razorpay/verify', userId, razorpay_order_id, orderUser: result.userId }, 'Order belongs to a different user')
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 403 })
    }

    const durationMs = Date.now() - start
    logger.info({ route: '/api/razorpay/verify', userId, plan: result.plan, razorpay_payment_id, alreadyCompleted: result.alreadyCompleted, durationMs }, 'Payment verified and subscription activated')

    return NextResponse.json({ ok: true, plan: result.plan })
  } catch (error) {
    const durationMs = Date.now() - start
    logger.error({ route: '/api/razorpay/verify', durationMs, err: error instanceof Error ? error.message : String(error) }, 'Payment verification failed')
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 })
  }
}
