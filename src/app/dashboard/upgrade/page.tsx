'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/language-context'
import { Check, Star, Sparkles, Zap, Shield, Loader2 } from 'lucide-react'

interface SubscriptionStatus {
  tier: string
  limits: { maxReports: number; maxFamilyMembers: number }
  usage: { reports: number; familyMembers: number }
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

export default function UpgradePage() {
  const { t } = useLanguage()
  const [annual, setAnnual] = useState(true)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)

  useEffect(() => {
    fetch('/api/subscription/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {})
  }, [])

  async function handleCheckout(plan: 'pro_monthly' | 'pro_annual') {
    setLoading(true)
    try {
      // Create order on server
      const orderRes = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const orderData = await orderRes.json()
      if (!orderData.orderId) {
        alert(orderData.error || 'Failed to create order')
        setLoading(false)
        return
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'CareDesk',
        description: plan === 'pro_monthly' ? 'CareDesk Pro — Monthly' : 'CareDesk Pro — Annual',
        order_id: orderData.orderId,
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          // Verify payment on server
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan,
            }),
          })
          const verifyData = await verifyRes.json()
          if (verifyData.ok) {
            window.location.href = '/dashboard/upgrade?success=true'
          } else {
            alert('Payment verification failed. Please contact support.')
          }
        },
        prefill: {
          name: '',
          email: '',
        },
        theme: {
          color: '#0059bb',
        },
        modal: {
          ondismiss: function () {
            setLoading(false)
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      alert('Payment failed to initialize. Please try again.')
      console.error('Checkout error:', err)
    }
    setLoading(false)
  }

  const isPro = status?.tier === 'pro_monthly' || status?.tier === 'pro_annual'

  const freeFeatures = [
    'Up to 2 report uploads',
    'Basic AI summary & explanations',
    '1 user profile',
    'Standard response speed',
  ]

  const proFeatures = [
    'Unlimited report uploads',
    'Advanced AI trend & biomarker tracking',
    'Up to 4 family member profiles',
    'Export summary PDFs for doctors',
    'Priority AI processing speed',
  ]

  return (
    <div className="p-5 md:p-8">
      {/* Razorpay Script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      {/* Header */}
      <div className="mb-8 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel border-electric-blue/30 mb-4">
          <Sparkles className="size-4 text-electric-blue" />
          <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-deep-navy">Upgrade Your Health Journey</span>
        </div>
        <h1 className="text-[28px] leading-[36px] md:text-[32px] md:leading-[40px] font-semibold text-deep-navy mb-3">
          Choose the right plan for your family
        </h1>
        <p className="text-[16px] text-on-surface-variant">
          Start free, upgrade when you need unlimited insights and family sharing.
        </p>
      </div>

      {/* Annual/Monthly Toggle */}
      <div className="flex justify-center mb-8">
        <div className="glass-panel rounded-full p-1 inline-flex items-center gap-1">
          <button
            onClick={() => setAnnual(false)}
            className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all ${
              !annual
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all relative ${
              annual
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Annual
            <span className="absolute -top-3 -right-4 bg-electric-blue text-deep-navy text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        {/* Free Tier */}
        <div className="glass-panel organic-radius p-8 flex flex-col">
          <div className="mb-6">
            <h3 className="text-[20px] font-semibold text-deep-navy mb-1">Free</h3>
            <p className="text-[14px] text-on-surface-variant">Perfect for trying out CareDesk</p>
          </div>
          <div className="mb-6">
            <span className="text-[40px] font-bold text-deep-navy">₹0</span>
            <span className="text-[16px] text-on-surface-variant ml-1">forever</span>
          </div>
          <ul className="space-y-3 mb-8 flex-grow">
            {freeFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-[14px] text-on-surface">
                <Check className="size-4 text-secondary mt-0.5 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          {isPro ? (
            <Button variant="outline" className="w-full border-outline-variant/50" disabled>
              Downgrade
            </Button>
          ) : (
            <Button variant="outline" className="w-full border-outline-variant/50" disabled>
              Current Plan
            </Button>
          )}
        </div>

        {/* Pro Tier */}
        <div className="glass-panel-strong organic-radius p-8 flex flex-col relative overflow-hidden border-2 border-secondary/30">
          {/* Recommended Badge */}
          <div className="absolute top-0 right-0 bg-secondary text-white text-[11px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1">
            <Star className="size-3 fill-white" />
            RECOMMENDED
          </div>

          <div className="mb-6">
            <h3 className="text-[20px] font-semibold text-deep-navy mb-1 flex items-center gap-2">
              CareDesk Pro
              <Zap className="size-5 text-electric-blue" />
            </h3>
            <p className="text-[14px] text-on-surface-variant">For serious health tracking</p>
          </div>

          <div className="mb-6">
            {annual ? (
              <>
                <span className="text-[40px] font-bold text-deep-navy">₹399</span>
                <span className="text-[16px] text-on-surface-variant ml-1">/month</span>
                <p className="text-[13px] text-secondary font-medium mt-1">₹4,788 billed yearly — Save 20%</p>
              </>
            ) : (
              <>
                <span className="text-[40px] font-bold text-deep-navy">₹499</span>
                <span className="text-[16px] text-on-surface-variant ml-1">/month</span>
                <p className="text-[13px] text-on-surface-variant mt-1">Billed monthly</p>
              </>
            )}
          </div>

          {/* Family Value Anchor */}
          <div className="mb-4 glass-panel rounded-xl p-3 flex items-center gap-3 border border-electric-blue/10">
            <div className="w-10 h-10 rounded-full bg-electric-blue/10 flex items-center justify-center shrink-0">
              <Shield className="size-5 text-electric-blue" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-deep-navy">Covers your whole family</p>
              <p className="text-[12px] text-on-surface-variant">Up to 4 family member profiles included</p>
            </div>
          </div>

          <ul className="space-y-3 mb-8 flex-grow">
            {proFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-[14px] text-on-surface">
                <Check className="size-4 text-secondary mt-0.5 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          {isPro ? (
            <Button variant="outline" className="w-full border-outline-variant/50" disabled>
              Active Subscription
            </Button>
          ) : (
            <Button
              onClick={() => handleCheckout(annual ? 'pro_annual' : 'pro_monthly')}
              disabled={loading}
              className="w-full btn-primary-gradient"
            >
              {loading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              Upgrade to Pro
            </Button>
          )}
        </div>
      </div>

      {/* Current Usage */}
      {status && (
        <div className="mt-8 max-w-4xl mx-auto">
          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-[16px] font-semibold text-deep-navy mb-3">Your Current Usage</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[12px] font-bold tracking-wide uppercase text-on-surface-variant mb-1">Reports</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-[24px] font-bold text-deep-navy">{status.usage.reports}</span>
                  <span className="text-[14px] text-on-surface-variant">
                    / {status.limits.maxReports === -1 ? '∞' : status.limits.maxReports}
                  </span>
                </div>
                {status.limits.maxReports !== -1 && (
                  <div className="mt-2 h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all"
                      style={{ width: `${Math.min((status.usage.reports / status.limits.maxReports) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <div>
                <p className="text-[12px] font-bold tracking-wide uppercase text-on-surface-variant mb-1">Family Members</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-[24px] font-bold text-deep-navy">{status.usage.familyMembers}</span>
                  <span className="text-[14px] text-on-surface-variant">
                    / {status.limits.maxFamilyMembers || '∞'}
                  </span>
                </div>
                {status.limits.maxFamilyMembers > 0 && (
                  <div className="mt-2 h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all"
                      style={{ width: `${Math.min((status.usage.familyMembers / status.limits.maxFamilyMembers) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAQ */}
      <div className="mt-12 max-w-2xl mx-auto">
        <h2 className="text-[20px] font-semibold text-deep-navy text-center mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            { q: 'Is payment secure?', a: 'Payments are processed through Razorpay, India\'s most trusted payment gateway. Your card details are never stored on our servers.' },
            { q: 'What happens when I reach the 2-report limit?', a: 'You can still view existing reports, but you\'ll need to upgrade to Pro to upload more. Your existing data is always safe.' },
            { q: 'Can I share Pro with my family?', a: 'Pro includes up to 4 family member profiles. Each member gets their own dashboard and health insights.' },
            { q: 'How do I get a refund?', a: 'Contact us within 7 days of payment for a full refund. We\'re confident you\'ll love CareDesk Pro.' },
          ].map((faq) => (
            <div key={faq.q} className="glass-panel rounded-xl p-5">
              <h4 className="text-[15px] font-semibold text-deep-navy mb-2">{faq.q}</h4>
              <p className="text-[14px] text-on-surface-variant leading-[22px]">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
