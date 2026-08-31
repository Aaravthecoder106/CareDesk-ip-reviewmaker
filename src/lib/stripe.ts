import Stripe from 'stripe'

/**
 * Lazy Stripe server-side client.
 * Only initializes when first called at runtime (not during build).
 */
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    })
  }
  return _stripe
}

/**
 * Subscription plan definitions.
 * Price IDs must be created in Stripe Dashboard and set as env vars.
 */
export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
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
    price: 9.99,
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
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
    price: 7.99,
    interval: 'year' as const,
    annualTotal: 95,
    priceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID!,
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
