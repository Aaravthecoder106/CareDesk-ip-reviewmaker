import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { upsertSubscription, cancelSubscription } from '@/lib/data/subscriptions'
import Stripe from 'stripe'

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events for subscription lifecycle.
 * Configure this URL in Stripe Dashboard: https://your-domain.com/api/stripe/webhook
 */
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.clerk_user_id
        const plan = session.metadata?.plan

        if (!userId || !plan) break

        // Retrieve subscription details
        const subscriptionId = session.subscription as string
        if (!subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const sub = subscription as unknown as {
          current_period_start: number
          current_period_end: number
        }

        await upsertSubscription({
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscriptionId,
          plan,
          status: subscription.status,
          currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        })
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const inv = invoice as unknown as { subscription: string | null }
        const subscriptionId = inv.subscription
        if (!subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const userId = subscription.metadata?.clerk_user_id
        const plan = subscription.metadata?.plan

        if (!userId) break

        const sub = subscription as unknown as {
          current_period_start: number
          current_period_end: number
        }

        await upsertSubscription({
          userId,
          stripeCustomerId: invoice.customer as string,
          stripeSubscriptionId: subscriptionId,
          plan: plan || 'pro_monthly',
          status: subscription.status,
          currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.clerk_user_id
        const plan = subscription.metadata?.plan

        if (!userId) break

        const sub = subscription as unknown as {
          current_period_start: number
          current_period_end: number
        }

        await upsertSubscription({
          userId,
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          plan: plan || 'pro_monthly',
          status: subscription.status,
          currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.clerk_user_id

        if (userId) {
          await cancelSubscription(userId)
        }
        break
      }
    }
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
