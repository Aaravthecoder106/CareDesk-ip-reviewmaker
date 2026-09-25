export const PLANS = {
  free: {
    name: 'Free Explorer',
    tagline: 'Get started with basic health insights',
    priceGlobal: '$0',
    priceIndia: '₹0',
    priceInPaise: 0,
    equivalentMonthlyInr: 0,
    interval: null,
    maxReportsPerMonth: 2,
    maxReportsLabel: '2 Lifetime Reports',
    lifetimeCap: true,
    maxProfiles: 1,
    maxProfilesLabel: '1 Profile',
    features: [
      'Basic lab summary',
      'Standard AI health chat (5 msgs/day)',
      '7-day chat history',
    ],
  },
  pro_individual_monthly: {
    name: 'Pro Individual',
    tagline: 'For serious personal health tracking',
    priceGlobal: '$4.99/mo',
    priceIndia: '₹299/mo',
    priceInPaise: 29900,
    equivalentMonthlyInr: 299,
    interval: 'monthly',
    maxReportsPerMonth: 10,
    maxReportsLabel: '10 Reports / Month',
    lifetimeCap: false,
    maxProfiles: 1,
    maxProfilesLabel: '1 Profile',
    features: [
      'Full biomarker trend graphs',
      'Unlimited RAG AI health chat',
      'PDF export for doctor visits',
      'Medication conflict checker',
    ],
  },
  pro_individual_annual: {
    name: 'Pro Individual',
    tagline: 'For serious personal health tracking',
    priceGlobal: '$49/yr',
    priceIndia: '₹2,499/yr',
    priceInPaise: 249900,
    equivalentMonthlyInr: 208,
    interval: 'yearly',
    maxReportsPerMonth: 10,
    maxReportsLabel: '10 Reports / Month',
    lifetimeCap: false,
    maxProfiles: 1,
    maxProfilesLabel: '1 Profile',
    features: [
      'Full biomarker trend graphs',
      'Unlimited RAG AI health chat',
      'PDF export for doctor visits',
      'Medication conflict checker',
    ],
  },
  family_monthly: {
    name: 'Family Care',
    tagline: 'Complete care for your whole family',
    priceGlobal: '$9.99/mo',
    priceIndia: '₹699/mo',
    priceInPaise: 69900,
    equivalentMonthlyInr: 699,
    interval: 'monthly',
    maxReportsPerMonth: Infinity,
    maxReportsLabel: 'Unlimited Reports',
    lifetimeCap: false,
    maxProfiles: 5,
    maxProfilesLabel: 'Up to 5 Profiles',
    features: [
      'All Pro Individual features',
      'Multi-profile timeline (Parents, Kids)',
      'Emergency Health Summary card',
      'Priority AI processing speed',
    ],
  },
  family_annual: {
    name: 'Family Care',
    tagline: 'Complete care for your whole family',
    priceGlobal: '$89/yr',
    priceIndia: '₹5,499/yr',
    priceInPaise: 549900,
    equivalentMonthlyInr: 458,
    interval: 'yearly',
    maxReportsPerMonth: Infinity,
    maxReportsLabel: 'Unlimited Reports',
    lifetimeCap: false,
    maxProfiles: 5,
    maxProfilesLabel: 'Up to 5 Profiles',
    features: [
      'All Pro Individual features',
      'Multi-profile timeline (Parents, Kids)',
      'Emergency Health Summary card',
      'Priority AI processing speed',
    ],
  },
} as const

export type PlanTier = keyof typeof PLANS
export type PaidTier = Exclude<PlanTier, 'free'>

const PLAN_TIERS = Object.keys(PLANS) as PlanTier[]
const PAID_TIERS = PLAN_TIERS.filter((tier): tier is PaidTier => tier !== 'free')

export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === 'string' && PLAN_TIERS.includes(value as PlanTier)
}

export function isPaidTier(value: unknown): value is PaidTier {
  return typeof value === 'string' && PAID_TIERS.includes(value as PaidTier)
}

export function getPlanRank(tier: PlanTier): number {
  if (tier === 'free') return 0
  if (tier.startsWith('pro_individual_')) return 1
  return 2
}

export function isPaymentAmountValid(plan: unknown, orderAmount: unknown, paymentAmount: unknown): boolean {
  if (!isPaidTier(plan) || !Number.isInteger(orderAmount) || !Number.isInteger(paymentAmount)) return false
  return orderAmount === PLANS[plan].priceInPaise && paymentAmount === orderAmount
}

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
