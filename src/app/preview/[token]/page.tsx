'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Loader2, Lock, FileText, ArrowRight, CheckCircle2, AlertTriangle, AlertCircle, XCircle, Shield, Info } from 'lucide-react'
import { savePreviewTokenForMigration } from '@/components/guest-migration'
import { ReportMetricCards } from '@/components/reports/report-metric-cards'
import { normalizeReportAnalysis } from '@/lib/reports/report-analysis'

interface LabResult {
  test_name: string
  value: number | null
  unit: string | null
  flag: string | null
}

interface Medication {
  name: string
  dose: string | null
  frequency: string | null
}

interface Condition {
  name: string
  status: string | null
}

interface PreviewData {
  fileName: string
  summary: string
  summaryEnglish: string
  summaryHinglish: string
  labResults: LabResult[]
  medications: Medication[]
  conditions: Condition[]
  extractedVitals: unknown
  questionsForDoctor: string[]
  medicalDisclaimer: string
  createdAt: string
}

const FLAG_ICONS: Record<string, typeof CheckCircle2> = {
  normal: CheckCircle2,
  high: AlertTriangle,
  low: AlertCircle,
  critical: XCircle,
}

const FLAG_COLORS: Record<string, string> = {
  normal: 'text-green-600 bg-green-50',
  high: 'text-amber-600 bg-amber-50',
  low: 'text-blue-600 bg-blue-50',
  critical: 'text-red-600 bg-red-50',
}

export default function PreviewPage() {
  const params = useParams()
  const token = params.token as string
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    // Handle inline fallback (DB unavailable — data stored in sessionStorage)
    if (token === 'inline') {
      try {
        const raw = sessionStorage.getItem('previewData')
        if (raw) {
          const d = JSON.parse(raw) as Record<string, unknown>
          const analysis = normalizeReportAnalysis(d)
          setData({
            fileName: typeof d.fileName === 'string' && d.fileName ? d.fileName : 'Report',
            summary: analysis.summary,
            summaryEnglish: analysis.summaryEnglish,
            summaryHinglish: analysis.summaryHinglish,
            labResults: analysis.labResults,
            medications: analysis.medications,
            conditions: analysis.conditions,
            extractedVitals: analysis.extractedVitals,
            questionsForDoctor: analysis.questionsForDoctor,
            medicalDisclaimer: analysis.medicalDisclaimer,
            createdAt: new Date().toISOString(),
          })
          sessionStorage.removeItem('previewData')
        } else {
          setError('No analysis data found. Please upload again.')
        }
      } catch {
        setError('Failed to load preview data.')
      }
      setLoading(false)
      return
    }

    fetch(`/api/public/preview?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setError(d.error)
        } else {
          const analysis = normalizeReportAnalysis(d)
          setData({
            fileName: typeof d.fileName === 'string' && d.fileName ? d.fileName : 'Report',
            summary: analysis.summary,
            summaryEnglish: analysis.summaryEnglish,
            summaryHinglish: analysis.summaryHinglish,
            labResults: analysis.labResults,
            medications: analysis.medications,
            conditions: analysis.conditions,
            extractedVitals: analysis.extractedVitals,
            questionsForDoctor: analysis.questionsForDoctor,
            medicalDisclaimer: analysis.medicalDisclaimer,
            createdAt: typeof d.createdAt === 'string' ? d.createdAt : new Date().toISOString(),
          })
          // Persist token for post-signup migration
          savePreviewTokenForMigration(token)
        }
      })
      .catch(() => setError('Failed to load preview'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-electric-blue" />
          <p className="text-[14px] text-on-surface-variant">Loading your analysis…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="glass-panel organic-radius max-w-md p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="size-7 text-destructive" />
          </div>
          <h1 className="text-[20px] font-semibold text-deep-navy mb-2">Preview Unavailable</h1>
          <p className="text-[14px] text-on-surface-variant mb-6">{error || 'This preview link is invalid.'}</p>
          <Link href="/" className="btn-primary-gradient inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-[14px]">
            Analyze a New Report
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    )
  }

  const visibleLabs = data.labResults.slice(0, 3)
  const hiddenLabs = data.labResults.slice(3)
  const visibleMeds = data.medications.slice(0, 2)
  const hiddenMeds = data.medications.slice(2)
  const visibleConditions = data.conditions.slice(0, 2)
  const hiddenConditions = data.conditions.slice(2)

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <nav className="sticky top-0 z-50 glass-panel-strong border-b border-white/50">
        <div className="flex justify-between items-center px-4 sm:px-6 py-3 max-w-[900px] mx-auto">
          <Logo size="md" />
          <Link
            href="/sign-up"
            className="btn-primary-gradient px-4 sm:px-5 py-2 rounded-full font-bold text-[13px] active:scale-95 transition-transform"
          >
            Sign Up Free
          </Link>
        </div>
      </nav>

      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="size-5 text-electric-blue" />
            <h1 className="text-[20px] sm:text-[24px] font-semibold text-deep-navy">Report Analysis Preview</h1>
          </div>
          <p className="text-[13px] text-on-surface-variant">
            Analyzed: {data.fileName} · {new Date(data.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Bilingual summaries */}
        <section aria-label="Bilingual report summaries" className="mb-5 grid gap-4 sm:grid-cols-2">
          <article className="glass-panel rounded-xl border border-electric-blue/10 p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric-blue/10">
                <span className="material-symbols-outlined text-lg text-electric-blue" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              </div>
              <h2 className="text-[16px] font-semibold text-deep-navy">English summary</h2>
            </div>
            <p className="text-[15px] leading-[24px] text-on-surface">{data.summaryEnglish}</p>
          </article>
          <article className="glass-panel rounded-xl border border-primary/10 p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-sm font-bold text-primary" aria-hidden="true">हि</span>
              </div>
              <h2 className="text-[16px] font-semibold text-deep-navy">Conversational Hinglish summary</h2>
            </div>
            <p className="text-[15px] leading-[24px] text-on-surface">{data.summaryHinglish}</p>
          </article>
        </section>

        {/* Structured key biomarkers */}
        <section className="glass-panel mb-5 rounded-xl p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-[16px] font-semibold text-deep-navy">Key biomarkers detected</h2>
            <p className="mt-1 text-[13px] leading-5 text-on-surface-variant">
              Values and ranges are shown only when extracted from the uploaded report. Missing values are not interpreted as zero.
            </p>
          </div>
          <ReportMetricCards vitals={data.extractedVitals} />
        </section>

        {/* Lab Results */}
        <div className="glass-panel rounded-xl p-5 sm:p-6 mb-5">
          <h2 className="text-[16px] font-semibold text-deep-navy mb-4">Lab Results</h2>
          {visibleLabs.length > 0 ? (
            <div className="space-y-2.5">
              {visibleLabs.map((lab, i) => {
                const Icon = lab.flag ? FLAG_ICONS[lab.flag] || Info : Info
                const colorClass = lab.flag
                  ? FLAG_COLORS[lab.flag] || 'text-on-surface-variant bg-surface-container'
                  : 'text-on-surface-variant bg-surface-container'
                return (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-container-low/50">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${colorClass}`}>
                        <Icon className="size-3.5" />
                      </div>
                      <span className="text-[14px] font-medium text-deep-navy">{lab.test_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[14px] font-semibold text-deep-navy">
                        {lab.value != null ? lab.value : '—'} {lab.unit || ''}
                      </span>
                      {lab.flag && lab.flag !== 'normal' && (
                        <span className={`ml-2 text-[11px] font-semibold uppercase ${colorClass} px-1.5 py-0.5 rounded`}>
                          {lab.flag}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-[13px] text-on-surface-variant">No lab values detected in this report.</p>
          )}

          {/* Blurred hidden results */}
          {hiddenLabs.length > 0 && (
            <div className="relative mt-3">
              <div className="space-y-2.5 blur-[6px] pointer-events-none select-none opacity-60">
                {hiddenLabs.map((lab, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-container-low/50">
                    <span className="text-[14px] font-medium text-deep-navy">{lab.test_name}</span>
                    <span className="text-[14px] font-semibold text-deep-navy">{lab.value} {lab.unit || ''}</span>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="glass-panel-strong px-4 py-2 rounded-full flex items-center gap-2 border border-white/40">
                  <Lock className="size-3.5 text-electric-blue" />
                  <span className="text-[12px] font-semibold text-deep-navy">{hiddenLabs.length} more results</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Medications */}
        {data.medications.length > 0 && (
          <div className="glass-panel rounded-xl p-5 sm:p-6 mb-5">
            <h2 className="text-[16px] font-semibold text-deep-navy mb-4">Medications</h2>
            <div className="space-y-2">
              {visibleMeds.map((med, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-container-low/50">
                  <div>
                    <span className="text-[14px] font-medium text-deep-navy">{med.name}</span>
                    {med.dose && <span className="text-[13px] text-on-surface-variant ml-2">{med.dose}</span>}
                  </div>
                  {med.frequency && <span className="text-[13px] text-on-surface-variant">{med.frequency}</span>}
                </div>
              ))}
            </div>
            {hiddenMeds.length > 0 && (
              <div className="relative mt-2">
                <div className="blur-[6px] pointer-events-none select-none opacity-60 space-y-2">
                  {hiddenMeds.map((med, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-container-low/50">
                      <span className="text-[14px] font-medium text-deep-navy">{med.name}</span>
                      <span className="text-[13px] text-on-surface-variant">{med.frequency || ''}</span>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="glass-panel-strong px-4 py-2 rounded-full flex items-center gap-2 border border-white/40">
                    <Lock className="size-3.5 text-electric-blue" />
                    <span className="text-[12px] font-semibold text-deep-navy">{hiddenMeds.length} more</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conditions */}
        {data.conditions.length > 0 && (
          <div className="glass-panel rounded-xl p-5 sm:p-6 mb-5">
            <h2 className="text-[16px] font-semibold text-deep-navy mb-4">Conditions</h2>
            <div className="space-y-2">
              {visibleConditions.map((cond, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-container-low/50">
                  <span className="text-[14px] font-medium text-deep-navy">{cond.name}</span>
                  {cond.status && (
                    <span className="text-[12px] font-semibold uppercase text-on-surface-variant">{cond.status}</span>
                  )}
                </div>
              ))}
            </div>
            {hiddenConditions.length > 0 && (
              <div className="relative mt-2">
                <div className="blur-[6px] pointer-events-none select-none opacity-60 space-y-2">
                  {hiddenConditions.map((cond, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-container-low/50">
                      <span className="text-[14px] font-medium text-deep-navy">{cond.name}</span>
                      <span className="text-[12px] uppercase text-on-surface-variant">{cond.status}</span>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="glass-panel-strong px-4 py-2 rounded-full flex items-center gap-2 border border-white/40">
                    <Lock className="size-3.5 text-electric-blue" />
                    <span className="text-[12px] font-semibold text-deep-navy">{hiddenConditions.length} more</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fixed disclaimer independent of model output */}
        <section aria-label="Medical disclaimer" role="note" className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden="true" />
          <div>
            <h2 className="text-[14px] font-semibold text-amber-950">Medical disclaimer</h2>
            <p className="mt-1 text-[13px] leading-6 text-amber-950">{data.medicalDisclaimer}</p>
          </div>
        </section>

        {data.questionsForDoctor.length > 0 && (
          <section className="glass-panel mb-5 rounded-xl p-5 sm:p-6">
            <h2 className="mb-3 text-[16px] font-semibold text-deep-navy">Questions to discuss with a doctor</h2>
            <ul className="list-disc space-y-2 pl-5 text-[14px] leading-6 text-on-surface">
              {data.questionsForDoctor.map((question, index) => <li key={index}>{question}</li>)}
            </ul>
          </section>
        )}

        {/* Signup CTA */}
        <div className="glass-panel-strong organic-radius p-6 sm:p-8 text-center border-2 border-electric-blue/20">
          <div className="w-14 h-14 rounded-full bg-electric-blue/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="size-7 text-electric-blue" />
          </div>
          <h2 className="text-[20px] sm:text-[24px] font-semibold text-deep-navy mb-2">
            Want the full picture?
          </h2>
          <p className="text-[14px] text-on-surface-variant mb-6 max-w-md mx-auto">
            Sign up free to unlock all lab results, track trends over time, get AI health chat, and share reports with your family.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sign-up"
              className="btn-primary-gradient inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full font-bold text-[15px] active:scale-[0.98] transition-transform"
            >
              Sign Up — It&apos;s Free
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/"
              className="btn-glass inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-[14px]"
            >
              Analyze Another Report
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-on-surface-variant/60">
            No credit card required · 2 free reports · Upgrade anytime
          </p>
        </div>
      </div>
    </div>
  )
}
