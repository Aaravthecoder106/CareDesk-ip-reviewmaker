import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type { PlanTier } from '@/lib/stripe'
import { getPlanLimits } from '@/lib/stripe'

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
  if (data.plan === 'pro_monthly' || data.plan === 'pro_annual') return data.plan as PlanTier
  return 'free'
}

/**
 * Check if the user has an active Pro subscription.
 */
export async function isProUser(userId: string): Promise<boolean> {
  const tier = await getUserSubscription(userId)
  return tier !== 'free'
}

/**
 * Get the user's upload limit (reports count).
 */
export async function getUserReportLimit(userId: string): Promise<number> {
  const tier = await getUserSubscription(userId)
  const limits = getPlanLimits(tier)
  return limits.maxReports === Infinity ? Infinity : limits.maxReports
}

/**
 * Get the user's family member limit.
 */
export async function getUserFamilyLimit(userId: string): Promise<number> {
  const tier = await getUserSubscription(userId)
  const limits = getPlanLimits(tier)
  return limits.maxFamilyMembers
}

/**
 * Count the user's current reports.
 */
export async function getUserReportCount(userId: string): Promise<number> {
  const supabase = await createClerkSupabaseClient()
  const { count } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', userId)
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
 * Upsert a subscription record (used by webhooks).
 */
export async function upsertSubscription(params: {
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
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
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId,
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
 * Cancel a subscription (set status to 'canceled').
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
      stripeSubscriptionId: null,
    }
  }

  return {
    tier: (data.status === 'active' && (data.plan === 'pro_monthly' || data.plan === 'pro_annual')
      ? data.plan
      : 'free') as PlanTier,
    status: data.status,
    currentPeriodEnd: data.current_period_end,
    stripeSubscriptionId: data.stripe_subscription_id,
  }
}
