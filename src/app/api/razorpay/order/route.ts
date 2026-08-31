import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getRazorpay, PLANS } from '@/lib/razorpay'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * POST /api/razorpay/order
 * Creates a Razorpay order for one-time subscription payment.
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

    // Get user email for receipt
    const supabase = createAdminSupabaseClient()
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    // Create Razorpay order
    const razorpay = getRazorpay()
    const amount = plan === 'pro_monthly' ? 49900 : 47880 // Amount in paise (₹499 or ₹4788)

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `caredesk_${userId.slice(0, 16)}_${plan}_${Date.now()}`,
      notes: {
        clerk_user_id: userId,
        plan,
        email: user?.email || '',
      },
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    })
  } catch (error) {
    console.error('Razorpay order error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
