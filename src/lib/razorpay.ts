import Razorpay from 'razorpay'

/**
 * Lazy Razorpay server-side client.
 * Only initializes when first called at runtime (not during build).
 */
let _razorpay: Razorpay | null = null

export function getRazorpay(): Razorpay {
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })
  }
  return _razorpay
}

/**
 * Subscription plan definitions with INR pricing.
 * Plan IDs must be created in Razorpay Dashboard and set as env vars.
 */
export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceInPaise: 0,
    interval: null as null,
    maxReports: 2,
    maxFamilyMembers: 0,
    features: [
      'Up to 2 report uploads',
      'Basic AI summary & explanations',
      '1 user profile',
      'Standard response speed',
    ],
  },
  pro_monthly: {
    name: 'CareDesk Pro',
    price: 499,
    priceFormatted: '₹499',
    interval: 'monthly' as const,
    planId: process.env.RAZORPAY_PLAN_MONTHLY_ID!,
    maxReports: Infinity,
    maxFamilyMembers: 4,
    features: [
      'Unlimited report uploads',
      'Advanced AI trend & biomarker tracking',
      'Up to 4 family member profiles',
      'Export summary PDFs for doctors',
      'Priority AI processing speed',
    ],
  },
  pro_annual: {
    name: 'CareDesk Pro',
    price: 399,
    priceFormatted: '₹399',
    interval: 'yearly' as const,
    annualTotal: 4788,
    annualTotalFormatted: '₹4,788',
    planId: process.env.RAZORPAY_PLAN_ANNUAL_ID!,
    maxReports: Infinity,
    maxFamilyMembers: 4,
    features: [
      'Unlimited report uploads',
      'Advanced AI trend & biomarker tracking',
      'Up to 4 family member profiles',
      'Export summary PDFs for doctors',
      'Priority AI processing speed',
      'Save 20% — best value',
    ],
  },
} as const

export type PlanTier = 'free' | 'pro_monthly' | 'pro_annual'

/**
 * Verify a Razorpay payment signature.
 */
export function verifyRazorpaySignature(params: {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto')
  const body = `${params.razorpay_order_id}|${params.razorpay_payment_id}`
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex')
  return expectedSignature === params.razorpay_signature
}

/**
 * Get the plan limits for a given tier.
 */
export function getPlanLimits(tier: PlanTier) {
  const plan = PLANS[tier]
  return {
    maxReports: plan.maxReports,
    maxFamilyMembers: plan.maxFamilyMembers,
    isPro: tier !== 'free',
  }
}
