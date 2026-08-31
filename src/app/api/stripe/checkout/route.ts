import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe, PLANS } from '@/lib/stripe'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for upgrading to Pro.
 * Body: { plan: 'pro_monthly' | 'pro_annual' }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan } = await req.json()
    if (plan !== 'pro_monthly' && plan !== 'pro_annual') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const planConfig = plan === 'pro_monthly' ? PLANS.pro_monthly : PLANS.pro_annual
    if (!planConfig.priceId) {
      return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 })
    }

    // Get or create Stripe customer
    const supabase = createAdminSupabaseClient()
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single()

    let customerId = sub?.stripe_customer_id

    if (!customerId) {
      // Get user email from Clerk
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()

      const customer = await stripe.customers.create({
        email: user?.email || undefined,
        metadata: { clerk_user_id: userId },
      })
      customerId = customer.id
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: planConfig.priceId,
          quantity: 1,
        },
      ],
      success_url: `${req.headers.get('origin')}/dashboard/upgrade?success=true`,
      cancel_url: `${req.headers.get('origin')}/dashboard/upgrade?canceled=true`,
      metadata: {
        clerk_user_id: userId,
        plan,
      },
      subscription_data: {
        metadata: {
          clerk_user_id: userId,
          plan,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
