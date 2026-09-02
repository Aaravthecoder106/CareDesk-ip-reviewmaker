/**
 * Plan tier definitions for CareDesk subscriptions
 * Removed Razorpay dependencies - now using manual payment verification
 */

export type PlanTier = 
  | 'free'
  | 'pro_individual_monthly'
  | 'pro_individual_annual'
  | 'family_monthly'
  | 'family_annual'

export interface PlanLimits {
  maxReportsPerMonth: number
  lifetimeCap: boolean
  maxProfiles: number
  maxChatMessagesPerDay?: number
  chatHistoryDays?: number
}

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxReportsPerMonth: 2,
    lifetimeCap: true,
    maxProfiles: 1,
    maxChatMessagesPerDay: 5,
    chatHistoryDays: 7,
  },
  pro_individual_monthly: {
    maxReportsPerMonth: 10,
    lifetimeCap: false,
    maxProfiles: 1,
    maxChatMessagesPerDay: Infinity,
    chatHistoryDays: 365,
  },
  pro_individual_annual: {
    maxReportsPerMonth: 10,
    lifetimeCap: false,
    maxProfiles: 1,
    maxChatMessagesPerDay: Infinity,
    chatHistoryDays: 365,
  },
  family_monthly: {
    maxReportsPerMonth: Infinity,
    lifetimeCap: false,
    maxProfiles: 5,
    maxChatMessagesPerDay: Infinity,
    chatHistoryDays: 365,
  },
  family_annual: {
    maxReportsPerMonth: Infinity,
    lifetimeCap: false,
    maxProfiles: 5,
    maxChatMessagesPerDay: Infinity,
    chatHistoryDays: 365,
  },
}

export function getPlanLimits(tier: PlanTier): PlanLimits {
  return PLAN_LIMITS[tier] || PLAN_LIMITS.free
}

export function getPlanName(tier: PlanTier): string {
  const names: Record<PlanTier, string> = {
    free: 'Free Explorer',
    pro_individual_monthly: 'Pro Individual (Monthly)',
    pro_individual_annual: 'Pro Individual (Annual)',
    family_monthly: 'Family Care (Monthly)',
    family_annual: 'Family Care (Annual)',
  }
  return names[tier] || 'Free Explorer'
}

export function isPaidTier(tier: PlanTier): boolean {
  return tier !== 'free'
}
