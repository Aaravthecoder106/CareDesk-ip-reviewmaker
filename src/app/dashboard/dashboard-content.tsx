'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  HeartPulse,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  AlertTriangle,
} from 'lucide-react'
import { ParentProfileCard } from '@/components/care/parent-profile-card'
import { useLanguage } from '@/lib/i18n/language-context'
import type { CareOverviewRecipient, CareStatus } from '@/lib/care/types'

interface DashboardContentProps {
  firstName?: string | null
}

const STATUS_TILE: Record<CareStatus, { labelKey: string; descriptionKey: string; Icon: typeof CheckCircle2; color: string }> = {
  GREEN: {
    labelKey: 'careDashboard.status.allGood',
    descriptionKey: 'careDashboard.statusDesc.complete',
    Icon: CheckCircle2,
    color: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  },
  YELLOW: {
    labelKey: 'careDashboard.status.pending',
    descriptionKey: 'careDashboard.statusDesc.pending',
    Icon: Clock3,
    color: 'text-amber-700 bg-amber-50 border-amber-100',
  },
  RED: {
    labelKey: 'careDashboard.status.attention',
    descriptionKey: 'careDashboard.statusDesc.alert',
    Icon: AlertTriangle,
    color: 'text-rose-700 bg-rose-50 border-rose-100',
  },
}

export function DashboardContent({ firstName }: DashboardContentProps) {
  const { t } = useLanguage()
  const [recipients, setRecipients] = useState<CareOverviewRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch('/api/care/overview', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'We could not load your family care dashboard.')
      setRecipients(Array.isArray(result.recipients) ? result.recipients : [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'We could not load your family care dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const counts = useMemo(() => ({
    GREEN: recipients.filter((profile) => profile.status === 'GREEN').length,
    YELLOW: recipients.filter((profile) => profile.status === 'YELLOW').length,
    RED: recipients.filter((profile) => profile.status === 'RED').length,
  }), [recipients])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-5 md:p-8 lg:p-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t('careDashboard.eyebrow')}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-deep-navy sm:text-3xl">{t('careDashboard.title')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
            {firstName ? t('careDashboard.welcome', { name: firstName }) + ' ' : ''}{t('careDashboard.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadOverview()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant/70 bg-white px-4 py-2.5 text-sm font-semibold text-deep-navy transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} aria-hidden="true" />
            {t('careDashboard.refresh')}
          </button>
          <Link
            href="/dashboard/care"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('careDashboard.addParent')}
          </Link>
        </div>
      </header>

      <section aria-label={t('careDashboard.statusSummary')} className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(STATUS_TILE) as CareStatus[]).map((status) => {
          const tile = STATUS_TILE[status]
          const Icon = tile.Icon
          return (
            <div key={status} className={'flex items-center gap-3 rounded-2xl border p-4 ' + tile.color}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t(tile.labelKey)}</p>
                <p className="mt-0.5 text-xs opacity-80">{t(tile.descriptionKey)}</p>
              </div>
              <span className="text-2xl font-semibold tabular-nums">{counts[status]}</span>
            </div>
          )
        })}
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-deep-navy">{t('careDashboard.parentsTitle')}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t('careDashboard.parentsDesc')}</p>
          </div>
          <p className="text-xs text-on-surface-variant">
            {t(recipients.length === 1 ? 'careDashboard.profileCount.one' : 'careDashboard.profileCount.other', { count: recipients.length })}
          </p>
        </div>

        {loading && recipients.length === 0 ? (
          <div role="status" aria-label={t('careDashboard.loading')} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-2xl border border-outline-variant/50 bg-white p-5">
                <div className="h-4 w-2/5 rounded bg-surface-container-high" />
                <div className="mt-4 h-3 w-3/5 rounded bg-surface-container-high" />
                <div className="mt-8 h-20 rounded-xl bg-surface-container-low" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <p className="font-semibold text-rose-900">{t('careDashboard.loadErrorTitle')}</p>
            <p className="mt-1 text-sm text-rose-800">{loadError}</p>
            <button type="button" onClick={() => void loadOverview()} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t('careDashboard.tryAgain')}
            </button>
          </div>
        ) : recipients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-white px-6 py-10 text-center sm:px-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-deep-navy">{t('careDashboard.emptyTitle')}</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-on-surface-variant">{t('careDashboard.emptyDesc')}</p>
            <Link href="/dashboard/care" className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
              {t('careDashboard.createFirst')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recipients.map((profile) => <ParentProfileCard key={profile.id} profile={profile} />)}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-deep-navy">{t('careDashboard.quickActionsTitle')}</h2>
          <p className="mt-1 text-sm text-on-surface-variant">{t('careDashboard.quickActionsDesc')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/dashboard/reports" className="group flex items-center gap-4 rounded-2xl border border-outline-variant/60 bg-white p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.02]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-deep-navy">{t('careDashboard.analyzeTitle')}</h3>
              <p className="mt-1 text-sm text-on-surface-variant">{t('careDashboard.analyzeDesc')}</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
          <Link href="/dashboard/care" className="group flex items-center gap-4 rounded-2xl border border-outline-variant/60 bg-white p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.02]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <HeartPulse className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-deep-navy">{t('careDashboard.manageTitle')}</h3>
              <p className="mt-1 text-sm text-on-surface-variant">{t('careDashboard.manageDesc')}</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4 sm:p-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-800" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-sky-950">{t('careDashboard.privacyTitle')}</p>
          <p className="mt-1 text-sm leading-6 text-sky-900">{t('careDashboard.privacyDesc')}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 border-t border-outline-variant/50 pt-5 text-xs leading-5 text-on-surface-variant">
        <Activity className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{t('careDashboard.statusDisclaimer')}</p>
      </div>
    </div>
  )
}
