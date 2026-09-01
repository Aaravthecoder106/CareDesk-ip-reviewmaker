import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type { PlanTier } from '@/lib/razorpay'
import { getPlanLimits } from '@/lib/razorpay'

/** All valid plan tier strings stored in the DB */
const VALID_TIERS: PlanTier[] = [
  'free',
  'pro_individual_monthly',
  'pro_individual_annual',
  'family_monthly',
  'family_annual',
]

/**
 * Get the current user's subscription tier.
 * Falls back to 'free' if no subscription record exists.
 */
export async function getUserSubscription(userId: string): Promise<PlanTier> {
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .single()

  if (!data) return 'free'
  if (data.status !== 'active') return 'free'
  if (VALID_TIERS.includes(data.plan as PlanTier)) return data.plan as PlanTier
  return 'free'
}

/**
 * Check if the user has any active paid subscription.
 */
export async function isProUser(userId: string): Promise<boolean> {
  const tier = await getUserSubscription(userId)
  return tier !== 'free'
}

/**
 * Get the user's monthly report limit.
 * For 'free' tier, this is the lifetime cap (2).
 */
export async function getUserReportLimit(userId: string): Promise<number> {
  const tier = await getUserSubscription(userId)
  const limits = getPlanLimits(tier)
  return limits.maxReportsPerMonth === Infinity ? Infinity : limits.maxReportsPerMonth
}

/**
 * Get the user's family/profile limit.
 */
export async function getUserFamilyLimit(userId: string): Promise<number> {
  const tier = await getUserSubscription(userId)
  const limits = getPlanLimits(tier)
  return limits.maxProfiles
}

/**
 * Count the user's reports uploaded in the current billing month.
 * For free tier, counts ALL reports (lifetime cap).
 */
export async function getUserReportCount(userId: string): Promise<number> {
  const tier = await getUserSubscription(userId)
  const limits = getPlanLimits(tier)
  const supabase = await createClerkSupabaseClient()

  if (limits.lifetimeCap) {
    // Free tier: count all reports ever
    const { count } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', userId)
    return count || 0
  }

  // Paid tier: count reports from current month
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { count } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', userId)
    .gte('created_at', monthStart)
  return count || 0
}

/**
 * Count the user's current family members (accepted only).
 */
export async function getUserFamilyCount(userId: string): Promise<number> {
  const supabase = await createClerkSupabaseClient()
  const { count } = await supabase
    .from('family_members')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('status', 'accepted')
  return count || 0
}

/**
 * Upsert a subscription record (used by webhooks and payment verification).
 */
export async function upsertSubscription(params: {
  userId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  plan: string
  status: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
}) {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: params.userId,
        razorpay_order_id: params.razorpayOrderId,
        razorpay_payment_id: params.razorpayPaymentId,
        plan: params.plan,
        status: params.status,
        current_period_start: params.currentPeriodStart || null,
        current_period_end: params.currentPeriodEnd || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
  if (error) throw error
}

/**
 * Cancel a subscription (set status to 'canceled', plan to 'free').
 */
export async function cancelSubscription(userId: string) {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('subscriptions')
    .update({ plan: 'free', status: 'canceled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (error) throw error
}

/**
 * Get subscription details for the settings/billing page.
 */
export async function getSubscriptionDetails(userId: string) {
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!data) {
    return {
      tier: 'free' as PlanTier,
      status: 'active',
      currentPeriodEnd: null,
      razorpayPaymentId: null,
    }
  }

  const isActive = data.status === 'active' && VALID_TIERS.includes(data.plan as PlanTier) && data.plan !== 'free'

  return {
    tier: (isActive ? data.plan : 'free') as PlanTier,
    status: data.status,
    currentPeriodEnd: data.current_period_end,
    razorpayPaymentId: data.razorpay_payment_id,
  }
}
