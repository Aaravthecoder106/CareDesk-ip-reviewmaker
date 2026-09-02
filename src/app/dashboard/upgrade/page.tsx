'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Check, Star, Sparkles, Zap, Shield, Users, Loader2, FileText } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/env'

interface SubscriptionStatus {
  tier: string
  plan: { name: string; priceGlobal: string; priceIndia: string; features: string[] }
  limits: { maxReportsPerMonth: number; lifetimeCap: boolean; maxProfiles: number }
  usage: { reports: number; familyMembers: number }
}

// Client-side Supabase client - only initialize if env vars are available
const supabaseClient = typeof window !== 'undefined' && env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  : null

const PLANS = {
  free: {
    name: 'Free Explorer',
    tagline: 'Get started with basic health insights',
    monthlyGlobal: '$0',
    monthlyIndia: '₹0',
    annualGlobal: '$0',
    annualIndia: '₹0',
    maxReports: '2 Lifetime Reports',
    maxProfiles: '1 Profile',
    features: [
      'Basic lab summary',
      'Standard AI health chat (5 msgs/day)',
      '7-day chat history',
    ],
  },
  pro_individual: {
    name: 'Pro Individual',
    tagline: 'For serious personal health tracking',
    monthlyGlobal: '$4.99/mo',
    monthlyIndia: '₹299/mo',
    annualGlobal: '$49/yr',
    annualIndia: '₹2,499/yr',
    annualMonthlyGlobal: '$4.08/mo',
    annualMonthlyIndia: '₹208/mo',
    maxReports: '10 Reports / Month',
    maxProfiles: '1 Profile',
    features: [
      'Full biomarker trend graphs',
      'Unlimited RAG AI health chat',
      'PDF export for doctor visits',
      'Medication conflict checker',
    ],
  },
  family: {
    name: 'Family Care',
    tagline: 'Complete care for your whole family',
    monthlyGlobal: '$9.99/mo',
    monthlyIndia: '₹699/mo',
    annualGlobal: '$89/yr',
    annualIndia: '₹5,499/yr',
    annualMonthlyGlobal: '$7.42/mo',
    annualMonthlyIndia: '₹458/mo',
    maxReports: 'Unlimited Reports',
    maxProfiles: 'Up to 5 Profiles',
    features: [
      'All Pro Individual features',
      'Multi-profile timeline (Parents, Kids)',
      'Emergency Health Summary card',
      'Priority AI processing speed',
    ],
  },
}

export default function UpgradePage() {
  const [annual, setAnnual] = useState(true)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [transactionId, setTransactionId] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/subscription/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {})
  }, [])

  function getCurrentTier(): string {
    if (!status) return 'free'
    if (status.tier.startsWith('family_')) return 'family'
    if (status.tier.startsWith('pro_')) return 'pro_individual'
    return 'free'
  }

  const currentTier = getCurrentTier()

  async function handleManualPaymentSubmit(plan: string) {
    if (!transactionId.trim()) {
      toast({
        title: 'Transaction ID Required',
        description: 'Please enter the UPI transaction reference ID',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // Get user from Supabase auth
      if (!supabaseClient) {
        toast({
          title: 'Configuration Error',
          description: 'Payment system not configured. Please contact support.',
          variant: 'destructive',
        })
        return
      }

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
      if (userError || !user) {
        toast({
          title: 'Authentication Error',
          description: 'Please sign in to submit payment',
          variant: 'destructive',
        })
        return
      }

      const { error } = await supabaseClient.from('manual_payments').insert({
        user_id: user.id,
        plan: plan,
        transaction_id: transactionId.trim(),
        amount: plan.includes('family') 
          ? (annual ? 5499 : 699)
          : (annual ? 2499 : 299),
        currency: 'INR',
        status: 'pending_verification',
      })

      if (error) throw error

      toast({
        title: 'Payment Submitted Successfully',
        description: 'Your transaction ID has been recorded. We will verify and activate your subscription within 24-48 hours.',
      })

      setTransactionId('')
      setShowPaymentModal(false)
      setSelectedPlan(null)
      
      // Refresh subscription status after a delay
      setTimeout(() => {
        fetch('/api/subscription/status')
          .then(r => r.json())
          .then(setStatus)
          .catch(() => {})
      }, 3000)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit transaction ID. Please try again.'
      console.error('Manual payment submission error:', err)
      toast({
        title: 'Submission Failed',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  function openPaymentModal(plan: string) {
    setSelectedPlan(plan)
    setShowPaymentModal(true)
  }

  // PayPal/Buy Me A Coffee link for international users
  const INTERNATIONAL_PAYMENT_LINK = 'https://www.buymeacoffee.com/caredesk'

  return (
    <div className="p-4 sm:p-5 md:p-8">

      {/* Header */}
      <div className="mb-6 sm:mb-8 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel border-electric-blue/30 mb-4">
          <Sparkles className="size-4 text-electric-blue" />
          <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-deep-navy">Upgrade Your Health Journey</span>
        </div>
        <h1 className="text-[22px] sm:text-[28px] leading-[30px] sm:leading-[36px] md:text-[32px] md:leading-[40px] font-semibold text-deep-navy mb-2 sm:mb-3">
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
              Save 20%+
            </span>
          </button>
        </div>
      </div>

      {/* 3-Tier Pricing Cards */}
      <div className="grid gap-5 sm:gap-6 md:grid-cols-3 max-w-5xl mx-auto">
        {/* Free Explorer */}
        <div className="glass-panel organic-radius p-6 sm:p-7 flex flex-col">
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="size-5 text-on-surface-variant" />
              <h3 className="text-[18px] sm:text-[20px] font-semibold text-deep-navy">{PLANS.free.name}</h3>
            </div>
            <p className="text-[13px] text-on-surface-variant">{PLANS.free.tagline}</p>
          </div>
          <div className="mb-4">
            <span className="text-[36px] sm:text-[40px] font-bold text-deep-navy">₹0</span>
            <span className="text-[14px] text-on-surface-variant ml-1">forever</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">{PLANS.free.maxReports}</span>
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">{PLANS.free.maxProfiles}</span>
          </div>
          <ul className="space-y-2.5 mb-6 flex-grow">
            {PLANS.free.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-[13px] text-on-surface">
                <Check className="size-4 text-on-surface-variant mt-0.5 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          {currentTier === 'free' ? (
            <Button variant="outline" className="w-full border-outline-variant/50" disabled>
              Current Plan
            </Button>
          ) : (
            <Button variant="outline" className="w-full border-outline-variant/50" disabled>
              Downgrade
            </Button>
          )}
        </div>

        {/* Pro Individual */}
        <div className="glass-panel organic-radius p-6 sm:p-7 flex flex-col">
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="size-5 text-electric-blue" />
              <h3 className="text-[18px] sm:text-[20px] font-semibold text-deep-navy">{PLANS.pro_individual.name}</h3>
            </div>
            <p className="text-[13px] text-on-surface-variant">{PLANS.pro_individual.tagline}</p>
          </div>
          <div className="mb-4">
            {annual ? (
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[36px] sm:text-[40px] font-bold text-deep-navy">₹208</span>
                  <span className="text-[14px] text-on-surface-variant">/month</span>
                </div>
                <p className="text-[18px] sm:text-[20px] font-semibold text-secondary mt-1">₹2,499 <span className="text-[13px] font-medium text-on-surface-variant">billed yearly</span></p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[36px] sm:text-[40px] font-bold text-deep-navy">₹299</span>
                  <span className="text-[14px] text-on-surface-variant">/month</span>
                </div>
                <p className="text-[13px] text-on-surface-variant mt-1">Billed monthly</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-electric-blue/10 text-electric-blue">{PLANS.pro_individual.maxReports}</span>
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-electric-blue/10 text-electric-blue">{PLANS.pro_individual.maxProfiles}</span>
          </div>
          <ul className="space-y-2.5 mb-6 flex-grow">
            {PLANS.pro_individual.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-[13px] text-on-surface">
                <Check className="size-4 text-electric-blue mt-0.5 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          {currentTier === 'pro_individual' ? (
            <Button variant="outline" className="w-full border-outline-variant/50" disabled>
              Active Subscription
            </Button>
          ) : currentTier === 'family' ? (
            <Button variant="outline" className="w-full border-outline-variant/50" disabled>
              Included in Family Care
            </Button>
          ) : (
            <Button
              onClick={() => openPaymentModal(annual ? 'pro_individual_annual' : 'pro_individual_monthly')}
              disabled={loading}
              className="w-full btn-primary-gradient"
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Zap className="mr-2 size-4" />}
              Upgrade to Pro
            </Button>
          )}
        </div>

        {/* Family Care */}
        <div className="glass-panel-strong organic-radius p-6 sm:p-7 flex flex-col relative overflow-hidden border-2 border-secondary/30">
          {/* Recommended Badge */}
          <div className="absolute top-0 right-0 bg-secondary text-white text-[11px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1">
            <Star className="size-3 fill-white" />
            RECOMMENDED
          </div>

          <div className="mb-5">
            <div className="flex items-center gap-2 mb-1">
              <Users className="size-5 text-secondary" />
              <h3 className="text-[18px] sm:text-[20px] font-semibold text-deep-navy">{PLANS.family.name}</h3>
            </div>
            <p className="text-[13px] text-on-surface-variant">{PLANS.family.tagline}</p>
          </div>
          <div className="mb-4">
            {annual ? (
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[36px] sm:text-[40px] font-bold text-deep-navy">₹458</span>
                  <span className="text-[14px] text-on-surface-variant">/month</span>
                </div>
                <p className="text-[18px] sm:text-[20px] font-semibold text-secondary mt-1">₹5,499 <span className="text-[13px] font-medium text-on-surface-variant">billed yearly — Save 26%</span></p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[36px] sm:text-[40px] font-bold text-deep-navy">₹699</span>
                  <span className="text-[14px] text-on-surface-variant">/month</span>
                </div>
                <p className="text-[13px] text-on-surface-variant mt-1">Billed monthly</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-secondary/10 text-secondary">{PLANS.family.maxReports}</span>
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-secondary/10 text-secondary">{PLANS.family.maxProfiles}</span>
          </div>

          {/* Family Value Anchor */}
          <div className="mb-4 glass-panel rounded-xl p-3 flex items-center gap-3 border border-electric-blue/10">
            <div className="w-9 h-9 rounded-full bg-electric-blue/10 flex items-center justify-center shrink-0">
              <Shield className="size-4 text-electric-blue" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-deep-navy">Covers your whole family</p>
              <p className="text-[11px] text-on-surface-variant">5 profiles included — parents, kids, everyone</p>
            </div>
          </div>

          <ul className="space-y-2.5 mb-6 flex-grow">
            {PLANS.family.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-[13px] text-on-surface">
                <Check className="size-4 text-secondary mt-0.5 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          {currentTier === 'family' ? (
            <Button variant="outline" className="w-full border-outline-variant/50" disabled>
              Active Subscription
            </Button>
          ) : (
            <Button
              onClick={() => openPaymentModal(annual ? 'family_annual' : 'family_monthly')}
              disabled={loading}
              className="w-full btn-primary-gradient"
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
              Upgrade to Family Care
            </Button>
          )}
        </div>
      </div>

      {/* Current Usage */}
      {status && (
        <div className="mt-8 max-w-5xl mx-auto">
          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-[16px] font-semibold text-deep-navy mb-3">Your Current Usage</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[12px] font-bold tracking-wide uppercase text-on-surface-variant mb-1">Reports</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-[24px] font-bold text-deep-navy">{status.usage.reports}</span>
                  <span className="text-[14px] text-on-surface-variant">
                    / {status.limits.maxReportsPerMonth === -1 ? '∞' : status.limits.maxReportsPerMonth}
                    {status.limits.lifetimeCap ? ' (lifetime)' : '/mo'}
                  </span>
                </div>
                {status.limits.maxReportsPerMonth !== -1 && (
                  <div className="mt-2 h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all"
                      style={{ width: `${Math.min((status.usage.reports / status.limits.maxReportsPerMonth) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <div>
                <p className="text-[12px] font-bold tracking-wide uppercase text-on-surface-variant mb-1">Family Members</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-[24px] font-bold text-deep-navy">{status.usage.familyMembers}</span>
                  <span className="text-[14px] text-on-surface-variant">
                    / {status.limits.maxProfiles || '∞'}
                  </span>
                </div>
                {status.limits.maxProfiles > 0 && (
                  <div className="mt-2 h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all"
                      style={{ width: `${Math.min((status.usage.familyMembers / status.limits.maxProfiles) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-strong organic-radius p-6 sm:p-8 max-w-md w-full relative">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface"
            >
              ✕
            </button>
            
            <h3 className="text-xl font-semibold text-deep-navy mb-2">Complete Your Payment</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              {selectedPlan.includes('family') ? 'Family Care' : 'Pro Individual'} — {selectedPlan.includes('annual') ? 'Annual' : 'Monthly'}
            </p>

            {/* UPI QR Code Section */}
            <div className="mb-6">
              <div className="bg-white rounded-xl p-4 mb-4 flex justify-center">
                <Image
                  src="/qr_code.jpeg"
                  alt="UPI Payment QR Code"
                  width={200}
                  height={200}
                  className="rounded-lg shadow-md"
                />
              </div>
              
              <div className="bg-electric-blue/5 rounded-lg p-3 mb-4">
                <p className="text-xs text-electric-blue font-medium">
                  Scan the QR code above with any UPI app (GPay, PhonePe, Paytm, etc.) to pay 
                  {selectedPlan.includes('family') 
                    ? (annual ? ' ₹5,499' : ' ₹699') 
                    : (annual ? ' ₹2,499' : ' ₹299')}
                </p>
              </div>
            </div>

            {/* Transaction ID Input */}
            <div className="mb-6">
              <label htmlFor="transactionId" className="block text-sm font-medium text-deep-navy mb-2">
                Transaction Reference ID (UTR)
              </label>
              <input
                id="transactionId"
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g., 123456789012"
                className="w-full px-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface text-deep-navy placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-electric-blue/50 focus:border-transparent"
                maxLength={20}
              />
              <p className="text-xs text-on-surface-variant mt-1.5">
                Find this in your UPI app payment confirmation
              </p>
            </div>

            {/* Submit Button */}
            <Button
              onClick={() => handleManualPaymentSubmit(selectedPlan)}
              disabled={loading || !transactionId.trim()}
              className="w-full btn-primary-gradient mb-3"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="mr-2 size-4" />
                  Submit Payment for Verification
                </>
              )}
            </Button>

            {/* International Users Button */}
            <a
              href={INTERNATIONAL_PAYMENT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full"
            >
              <Button
                variant="outline"
                className="w-full border-outline-variant/50"
              >
                🌍 International Users: Pay Here
              </Button>
            </a>

            <p className="text-xs text-on-surface-variant text-center mt-4">
              We will verify and activate your subscription within 24-48 hours
            </p>
          </div>
        </div>
      )}

      {/* FAQ */}
      <div className="mt-8 sm:mt-12 max-w-2xl mx-auto">
        <h2 className="text-[20px] font-semibold text-deep-navy text-center mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            { q: 'Is payment secure?', a: "Payments are processed through UPI, India's most trusted payment system. Your transaction ID is securely stored for verification." },
            { q: 'What happens when I reach the 2-report limit on Free?', a: "You can still view existing reports, but you'll need to upgrade to upload more. Your existing data is always safe." },
            { q: 'Can I share Family Care with my family?', a: 'Family Care includes up to 5 member profiles. Each member gets their own dashboard and health insights. Multi-profile timeline lets you track everyone.' },
            { q: "What's the difference between Pro Individual and Family Care?", a: 'Pro Individual is for solo health tracking with 10 reports/month and 1 profile. Family Care adds unlimited reports, 5 profiles, emergency summaries, and priority AI processing.' },
            { q: 'How do I get a refund?', a: "Contact us within 7 days of payment for a full refund. We're confident you'll love CareDesk." },
            { q: 'How long does verification take?', a: 'We manually verify UPI payments within 24-48 hours. You\'ll receive a notification once your subscription is activated.' },
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
