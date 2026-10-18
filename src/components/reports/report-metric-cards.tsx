'use client'

import { Activity, FileSearch } from 'lucide-react'
import {
  normalizeExtractedVitals,
  REPORT_VITAL_FIELDS,
  type ReportLabFlag,
} from '@/lib/reports/report-analysis'

const FLAG_STYLES: Record<ReportLabFlag, string> = {
  normal: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  high: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-sky-200 bg-sky-50 text-sky-800',
  critical: 'border-rose-200 bg-rose-50 text-rose-800',
}

interface ReportMetricCardsProps {
  vitals: unknown
  emptyMessage?: string
}

export function ReportMetricCards({
  vitals,
  emptyMessage = 'No values for these biomarkers were confidently extracted. Check the original report; missing values are not interpreted as zero.',
}: ReportMetricCardsProps) {
  const normalized = normalizeExtractedVitals(vitals)
  const metrics = REPORT_VITAL_FIELDS
    .map((field) => ({ ...field, metric: normalized[field.key] }))
    .filter((field) => field.metric !== null)

  if (metrics.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant/70 bg-surface-container-low/40 p-4">
        <div className="flex items-start gap-2.5">
          <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
          <p className="text-sm leading-6 text-on-surface-variant">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map(({ key, label, metric }) => {
        if (!metric) return null
        const displayValue = metric.rawValue ?? (metric.value === null ? '—' : String(metric.value))
        return (
          <article key={key} className="min-w-0 rounded-xl border border-outline-variant/60 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-on-surface-variant">{label}</p>
              <Activity className="h-4 w-4 shrink-0 text-primary/70" aria-hidden="true" />
            </div>
            <p className="mt-3 break-words text-2xl font-semibold leading-tight tracking-tight text-deep-navy">
              {displayValue}
              {metric.unit && <span className="ml-1.5 text-sm font-medium text-on-surface-variant">{metric.unit}</span>}
            </p>
            {metric.referenceRange && (
              <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                <span className="font-medium">Report reference range:</span> {metric.referenceRange}
              </p>
            )}
            {metric.flag && (
              <div className="mt-3">
                <span className={'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ' + FLAG_STYLES[metric.flag]}>
                  Report flag: {metric.flag}
                </span>
              </div>
            )}
            {metric.sourceText && (
              <details className="mt-3 border-t border-outline-variant/40 pt-2.5">
                <summary className="cursor-pointer text-xs font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  Source excerpt
                </summary>
                <p className="mt-2 text-xs leading-5 text-on-surface-variant">{metric.sourceText}</p>
              </details>
            )}
          </article>
        )
      })}
    </div>
  )
}
