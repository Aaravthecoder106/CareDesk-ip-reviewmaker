'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/language-context'
import { Shield, Lock, Unlock, Loader2, Trash2, CreditCard, Crown, Calendar, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const { t } = useLanguage()
  const [hasPassword, setHasPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [sub, setSub] = useState<{ tier: string; status: string; currentPeriodEnd: string | null; paymentId: string | null } | null>(null)
  const [subLoading, setSubLoading] = useState(true)
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    checkPassword()
    fetchSubscription()
  }, [])

  async function checkPassword() {
    try {
      const res = await fetch('/api/library/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      })
      const data = await res.json()
      setHasPassword(!!data.locked)
    } catch {
      console.error('Failed to check password')
    }
    setLoading(false)
  }

  async function fetchSubscription() {
    try {
      const res = await fetch('/api/subscription/status')
      const data = await res.json()
      setSub({
        tier: data.tier || 'free',
        status: data.subscription?.status || 'active',
        currentPeriodEnd: data.subscription?.currentPeriodEnd || null,
        paymentId: data.subscription?.razorpayPaymentId || null,
      })
    } catch {
      console.error('Failed to fetch subscription')
    }
    setSubLoading(false)
  }

  async function handleCancelSubscription() {
    if (!confirm('Are you sure you want to cancel your subscription? You will be downgraded to the Free Explorer plan.')) return
    setCancelLoading(true)
    try {
      const res = await fetch('/api/razorpay/cancel', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setMessage('Subscription canceled successfully.')
        fetchSubscription()
      } else {
        setMessage(data.error || 'Failed to cancel subscription.')
      }
    } catch {
      setMessage('Failed to cancel subscription.')
    }
    setCancelLoading(false)
  }

  function formatTierName(tier: string): string {
    switch (tier) {
      case 'pro_individual_monthly':
      case 'pro_individual_annual':
        return 'Pro Individual'
      case 'family_monthly':
      case 'family_annual':
        return 'Family Care'
      default:
        return 'Free Explorer'
    }
  }

  async function handleSetPassword() {
    if (!password.trim()) return
    setActionLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/library/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', password }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessage(t('settings.libraryPassword.success'))
        setPassword('')
        setHasPassword(true)
      } else {
        setMessage(data.error || t('settings.libraryPassword.setError'))
      }
    } catch {
      setMessage(t('settings.libraryPassword.setError'))
    }
    setActionLoading(false)
  }

  async function handleRemovePassword() {
    setActionLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/library/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove' }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessage(t('settings.libraryPassword.removed'))
        setHasPassword(false)
      }
    } catch {
      setMessage(t('settings.libraryPassword.removeError'))
    }
    setActionLoading(false)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold sm:text-2xl">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('settings.subtitle')}
        </p>
      </div>

      <div className="space-y-6">
        {/* Subscription & Billing */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {sub && sub.tier !== 'free' ? <Crown className="size-4 text-electric-blue" /> : <CreditCard className="size-4" />}
              <CardTitle className="text-sm font-medium">Subscription & Billing</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {subLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : sub && sub.tier !== 'free' ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold text-deep-navy">{formatTierName(sub.tier)}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
                        Active
                      </span>
                    </div>
                    {sub.currentPeriodEnd && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Calendar className="size-3 text-on-surface-variant" />
                        <p className="text-[13px] text-on-surface-variant">
                          Renews {new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    )}
                    {sub.paymentId && (
                      <p className="text-[12px] text-on-surface-variant mt-1 font-mono">Payment: {sub.paymentId}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href="/dashboard/upgrade">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-1.5 size-3" />
                        Change Plan
                      </Button>
                    </Link>
                    <Button variant="destructive" size="sm" onClick={handleCancelSubscription} disabled={cancelLoading}>
                      {cancelLoading ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : <Trash2 className="mr-1.5 size-3" />}
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[15px] font-medium text-deep-navy">Free Explorer Plan</p>
                  <p className="text-[13px] text-on-surface-variant mt-0.5">Upgrade for unlimited reports, AI chat, and family sharing.</p>
                </div>
                <Link href="/dashboard/upgrade">
                  <Button className="btn-primary-gradient" size="sm">
                    <Crown className="mr-1.5 size-3" />
                    Upgrade
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Library Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {hasPassword ? <Lock className="size-4" /> : <Unlock className="size-4" />}
              <CardTitle className="text-sm font-medium">{t('settings.libraryPassword')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : hasPassword ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {t('settings.libraryPassword.protected')}
                </p>
                <Button variant="destructive" size="sm" onClick={handleRemovePassword} disabled={actionLoading} className="w-full sm:w-auto">
                  {actionLoading ? <Loader2 className="mr-2 size-3 animate-spin" /> : <Trash2 className="mr-2 size-3" />}
                  {t('settings.libraryPassword.remove')}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('settings.libraryPassword.setPlaceholder')}
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <Button onClick={handleSetPassword} disabled={actionLoading || !password.trim()} className="w-full sm:w-auto">
                  {actionLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Shield className="mr-2 size-4" />}
                  {t('settings.libraryPassword.set')}
                </Button>
              </div>
            )}
            {message && (
              <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            )}
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('settings.account.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('settings.account.desc')}
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
