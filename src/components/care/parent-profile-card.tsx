import Link from 'next/link'
import {
  Activity,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  HeartPulse,
  ShieldAlert,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import type { CareOverviewRecipient, CareStatus, CareStatusReason } from '@/lib/care/types'

const STATUS_PRESENTATION: Record<CareStatus, {
  labelKey: string
  className: string
  Icon: typeof CheckCircle2
}> = {
  GREEN: {
    labelKey: 'careStatus.allGood',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    Icon: CheckCircle2,
  },
  YELLOW: {
    labelKey: 'careStatus.pending',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    Icon: Clock3,
  },
  RED: {
    labelKey: 'careStatus.attention',
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    Icon: AlertTriangle,
  },
}

const REASON_TRANSLATION: Record<CareStatusReason, string> = {
  consent_pending: 'careReason.consentPending',
  consent_revoked: 'careReason.consentRevoked',
  consent_expired: 'careReason.consentExpired',
  missed_dose: 'careReason.missedDose',
  out_of_range: 'careReason.outOfRange',
  readings_pending: 'careReason.readingsPending',
  medication_schedule_missing: 'careReason.medicationScheduleMissing',
  medication_schedule_review: 'careReason.medicationScheduleReview',
  medication_log_incomplete: 'careReason.medicationLogIncomplete',
  baseline_missing: 'careReason.baselineMissing',
  all_good: 'careReason.allGood',
}

function formatTimestamp(value: string | null, locale: 'en' | 'hi') {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

export function ParentProfileCard({ profile }: { profile: CareOverviewRecipient }) {
  const { t, locale } = useLanguage()
  const status = STATUS_PRESENTATION[profile.status]
  const StatusIcon = status.Icon
  const consentNeeded = profile.consent_status !== 'active'
  const timestamp = formatTimestamp(profile.last_check_in_at, locale)

  return (
    <article className="flex h-full flex-col rounded-2xl border border-outline-variant/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <HeartPulse className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-deep-navy">{profile.full_name}</h3>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              {profile.age === null ? t('careCard.ageMissing') : t('careCard.age', { age: profile.age })}
            </p>
          </div>
        </div>
        <span className={'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ' + status.className}>
          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {t(status.labelKey)}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-on-surface-variant">{t(REASON_TRANSLATION[profile.status_reason])}</p>

      <div className="mt-5 rounded-xl bg-surface-container-low/70 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('careCard.lastCheckin')}
          </span>
          <span className="text-right text-xs font-medium text-deep-navy">
            {consentNeeded ? t('careCard.notAvailable') : timestamp ?? t('careCard.noCheckin')}
          </span>
        </div>
      </div>

      {!consentNeeded && profile.latest_vitals.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {profile.latest_vitals.slice(0, 2).map((vital) => (
            <div key={vital.type} className="rounded-xl border border-outline-variant/50 p-3">
              <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                {t('careVital.' + vital.type)}
              </p>
              <p className="mt-1.5 text-base font-semibold tabular-nums text-deep-navy">
                {vital.value} <span className="text-xs font-normal text-on-surface-variant">{vital.unit}</span>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex min-h-[76px] items-center gap-2 rounded-xl border border-dashed border-outline-variant/70 px-3.5 py-3 text-sm text-on-surface-variant">
          {consentNeeded
            ? <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            : <Activity className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span>{consentNeeded ? t('careCard.readingsUnlock') : t('careCard.noReadings')}</span>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <p className="text-xs text-on-surface-variant">
          {consentNeeded
            ? t('careCard.consentRequired')
            : profile.medication_summary.active_medications > 0 && profile.medication_summary.expected_today === 0
              ? t('careCard.medicationScheduleReview')
              : profile.medication_summary.expected_today > 0
              ? t('careCard.doseSummary', {
                  taken: profile.medication_summary.taken_today,
                  expected: profile.medication_summary.expected_today,
                })
              : t('careCard.noMedicationSchedule')}
        </p>
        <Link
          href="/dashboard/care"
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t('careCard.manage')}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}
