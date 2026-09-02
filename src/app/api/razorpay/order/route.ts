import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getRazorpay, assertRazorpayConfigured, PLANS, type PlanTier } from '@/lib/razorpay'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

/** All payable plan tiers (excludes 'free') */
const PAYABLE_PLANS: PlanTier[] = [
  'pro_individual_monthly',
  'pro_individual_annual',
  'family_monthly',
  'family_annual',
]

/**
 * POST /api/razorpay/order
 * Creates a Razorpay order for subscription payment.
 * Body: { plan: PlanTier }
 *
 * The plan and amount are recorded server-side in `razorpay_orders` so the
 * verify endpoint can bind the payment to what was actually purchased instead
 * of trusting a client-supplied plan.
 */
export async function POST(req: NextRequest) {
  try {
    assertRazorpayConfigured()

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan } = await req.json()
    if (!PAYABLE_PLANS.includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const planConfig = PLANS[plan as keyof typeof PLANS]

    // Get user email for receipt
    let userEmail = ''
    try {
      const user = await currentUser()
      userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    } catch {
      // Fallback to Supabase if Clerk fails
    }

    if (!userEmail) {
      const supabase = createAdminSupabaseClient()
      const { data: dbUser } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .maybeSingle()
      userEmail = dbUser?.email || ''
    }

    // Create Razorpay order
    const razorpay = getRazorpay()
    const amount = planConfig.priceInPaise // Already in paise

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `caredesk_${userId.slice(0, 16)}_${plan}_${Date.now()}`,
      notes: {
        clerk_user_id: userId,
        plan,
        email: userEmail,
      },
    })

    // Persist what was purchased BEFORE returning the order to the client.
    const supabase = createAdminSupabaseClient()
    const { error: insertError } = await supabase
      .from('razorpay_orders')
      .insert({
        order_id: order.id,
        user_id: userId,
        plan,
        amount,
        status: 'created',
      })
    if (insertError) {
      logger.error({ route: '/api/razorpay/order', userId, orderId: order.id, err: insertError.message }, 'Failed to record order')
      if (insertError.code === '42P01') {
        return NextResponse.json({ error: 'Subscriptions table not found. Please run migration 0004 in Supabase.' }, { status: 500 })
      }
      return NextResponse.json({ error: `Database error: ${insertError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    })
  } catch (error) {
    logger.error({ route: '/api/razorpay/order', err: error instanceof Error ? error.message : String(error) }, 'Razorpay order error')
    const message = error instanceof Error ? error.message : 'Failed to create order'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
