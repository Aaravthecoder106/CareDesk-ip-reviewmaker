import Razorpay from 'razorpay'

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
    throw new Error('Razorpay is not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET')
  }
  if (!isConfigured(process.env.RAZORPAY_WEBHOOK_SECRET)) {
    throw new Error('Razorpay is not configured: set RAZORPAY_WEBHOOK_SECRET')
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
 * 3-Tier subscription plan definitions.
 *
 * Free Explorer:  2 lifetime reports, 1 profile
 * Pro Individual: 10 reports/month, 1 profile (monthly or annual)
 * Family Care:    unlimited reports, 5 profiles (monthly or annual)
 *
 * Payments are one-time Razorpay orders (not Razorpay subscription plans):
 * the order amount is taken from `priceInPaise` here and the plan tier is
 * recorded server-side in the razorpay_orders table.
 */
export const PLANS = {
  free: {
    name: 'Free Explorer',
    priceGlobal: '$0',
    priceIndia: '₹0',
    priceInPaise: 0,
    interval: null as null,
    maxReportsPerMonth: 2, // lifetime cap — no reset
    lifetimeCap: true,
    maxProfiles: 1,
    features: [
      '2 lifetime report uploads',
      'Basic lab summary',
      'Standard AI health chat (5 msgs/day)',
      '7-day chat history',
    ],
  },
  pro_individual_monthly: {
    name: 'Pro Individual',
    priceGlobal: '$4.99/mo',
    priceIndia: '₹299/mo',
    priceInPaise: 29900,
    interval: 'monthly' as const,
    maxReportsPerMonth: 10,
    lifetimeCap: false,
    maxProfiles: 1,
    features: [
      '10 reports per month',
      'Full biomarker trend graphs',
      'Unlimited AI health chat',
      'PDF export for doctor visits',
      'Medication conflict checker',
    ],
  },
  pro_individual_annual: {
    name: 'Pro Individual',
    priceGlobal: '$49/yr',
    priceIndia: '₹2,499/yr',
    priceInPaise: 249900,
    interval: 'yearly' as const,
    maxReportsPerMonth: 10,
    lifetimeCap: false,
    maxProfiles: 1,
    features: [
      '10 reports per month',
      'Full biomarker trend graphs',
      'Unlimited AI health chat',
      'PDF export for doctor visits',
      'Medication conflict checker',
      'Save 17% — billed yearly',
    ],
  },
  family_monthly: {
    name: 'Family Care',
    priceGlobal: '$9.99/mo',
    priceIndia: '₹699/mo',
    priceInPaise: 69900,
    interval: 'monthly' as const,
    maxReportsPerMonth: Infinity,
    lifetimeCap: false,
    maxProfiles: 5,
    features: [
      'Unlimited reports',
      'Multi-profile timeline (Parents, Kids)',
      'Emergency Health Summary card',
      'Priority AI processing speed',
      'All Pro Individual features',
    ],
  },
  family_annual: {
    name: 'Family Care',
    priceGlobal: '$89/yr',
    priceIndia: '₹5,499/yr',
    priceInPaise: 549900,
    interval: 'yearly' as const,
    maxReportsPerMonth: Infinity,
    lifetimeCap: false,
    maxProfiles: 5,
    features: [
      'Unlimited reports',
      'Multi-profile timeline (Parents, Kids)',
      'Emergency Health Summary card',
      'Priority AI processing speed',
      'All Pro Individual features',
      'Save 26% — billed yearly',
    ],
  },
} as const

export type PlanTier =
  | 'free'
  | 'pro_individual_monthly'
  | 'pro_individual_annual'
  | 'family_monthly'
  | 'family_annual'

/** Tiers that count as any paid plan */
export type PaidTier = Exclude<PlanTier, 'free'>

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

/**
 * Get the plan limits for a given tier.
 */
export function getPlanLimits(tier: PlanTier) {
  const plan = PLANS[tier]
  return {
    maxReportsPerMonth: plan.maxReportsPerMonth,
    lifetimeCap: plan.lifetimeCap,
    maxProfiles: plan.maxProfiles,
    isPro: tier !== 'free',
    isFamily: tier.startsWith('family_'),
  }
}
