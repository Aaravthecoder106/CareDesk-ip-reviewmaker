import Razorpay from 'razorpay'

export { getPlanLimits, isPaidTier, isPaymentAmountValid, isPlanTier, PLANS } from '@/lib/plans'
export type { PaidTier, PlanTier } from '@/lib/plans'

/**
 * Lazy Razorpay server-side client.
 * Only initializes when first called at runtime (not during build).
 */
let _razorpay: Razorpay | null = null

function isConfigured(value: string | undefined): value is string {
  return !!value && value !== 'placeholder'
}

/**
 * Throw a clear error when payment routes are hit without real credentials.
 * env.ts allows 'placeholder' defaults so `next build` succeeds without env,
 * but no payment operation may run against placeholder keys.
 */
export function assertRazorpayConfigured() {
  if (!isConfigured(process.env.RAZORPAY_KEY_ID) || !isConfigured(process.env.RAZORPAY_KEY_SECRET)) {
    throw new Error('Razorpay is not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables in your deployment dashboard.')
  }
}

export function getRazorpay(): Razorpay {
  if (!_razorpay) {
    assertRazorpayConfigured()
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })
  }
  return _razorpay
}

/**
 * Verify a Razorpay payment signature.
 */
export function verifyRazorpaySignature(params: {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}): boolean {
  if (!isConfigured(process.env.RAZORPAY_KEY_SECRET)) return false
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto')
  const body = `${params.razorpay_order_id}|${params.razorpay_payment_id}`
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex')
  return expectedSignature === params.razorpay_signature
}
