import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserSubscription, getUserReportCount, getUserFamilyCount, getSubscriptionDetails } from '@/lib/data/subscriptions'
import { getPlanLimits, getPlanName } from '@/lib/plans'

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

    return NextResponse.json({
      tier,
      plan: {
        name: getPlanName(tier),
        priceGlobal: tier.includes('annual') ? (tier.includes('family') ? '$89/yr' : '$49/yr') : (tier.includes('family') ? '$9.99/mo' : '$4.99/mo'),
        priceIndia: tier.includes('annual') ? (tier.includes('family') ? '₹5,499/yr' : '₹2,499/yr') : (tier.includes('family') ? '₹699/mo' : '₹299/mo'),
        features: [],
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
      },
    })
  } catch (error) {
    console.error('Subscription status error:', error)
    return NextResponse.json({ error: 'Failed to get subscription status' }, { status: 500 })
  }
}
