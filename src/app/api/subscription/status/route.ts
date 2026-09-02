import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserSubscription, getUserReportCount, getUserFamilyCount, getSubscriptionDetails } from '@/lib/data/subscriptions'
import { getPlanLimits, PLANS } from '@/lib/razorpay'

/**
 * GET /api/subscription/status
 * Returns the current user's subscription tier, usage, and limits.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [tier, reportCount, familyCount, details] = await Promise.all([
      getUserSubscription(userId),
      getUserReportCount(userId),
      getUserFamilyCount(userId),
      getSubscriptionDetails(userId),
    ])

    const limits = getPlanLimits(tier)

    const plan = PLANS[tier as keyof typeof PLANS] || PLANS.free

    return NextResponse.json({
      tier,
      plan: {
        name: plan.name,
        priceGlobal: plan.priceGlobal,
        priceIndia: plan.priceIndia,
        features: plan.features,
      },
      limits: {
        maxReportsPerMonth: limits.maxReportsPerMonth === Infinity ? -1 : limits.maxReportsPerMonth,
        lifetimeCap: limits.lifetimeCap,
        maxProfiles: limits.maxProfiles,
      },
      usage: {
        reports: reportCount,
        familyMembers: familyCount,
      },
      subscription: {
        status: details.status,
        currentPeriodEnd: details.currentPeriodEnd,
        razorpayPaymentId: details.razorpayPaymentId,
      },
    })
  } catch (error) {
    console.error('Subscription status error:', error)
    return NextResponse.json({ error: 'Failed to get subscription status' }, { status: 500 })
  }
}
