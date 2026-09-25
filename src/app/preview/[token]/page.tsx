'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  FileText,
  FlaskConical,
  Loader2,
  Lock,
  Shield,
  Sparkles,
} from 'lucide-react'
import { getGuestSessionHeaders, isGuestSessionId } from '@/lib/guest-session'

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
  healthScore: number | null
  insights: string[]
  labResults: LabResult[]
  medications: Medication[]
  conditions: Condition[]
  createdAt: string
}

export default function PreviewPage() {
  const params = useParams()
  const routeValue = params.token as string
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!routeValue) {
      setError('No guest session was provided.')
      setLoading(false)
      return
    }

    if (routeValue === 'inline') {
      try {
        const raw = sessionStorage.getItem('previewData')
        if (!raw) throw new Error('No analysis data found')
        const inline = JSON.parse(raw)
        setData({
          fileName: inline.fileName || 'Report',
          summary: inline.summary || '',
          healthScore: inline.healthScore ?? null,
          insights: inline.insights || [],
          labResults: inline.labResults || [],
          medications: inline.medications || [],
          conditions: inline.conditions || [],
          createdAt: new Date().toISOString(),
        })
        sessionStorage.removeItem('previewData')
      } catch {
        setError('No analysis data found. Please upload again.')
      }
      setLoading(false)
      return
    }

    const guestSession = isGuestSessionId(routeValue)
    const query = guestSession ? `sessionId=${encodeURIComponent(routeValue)}` : `token=${encodeURIComponent(routeValue)}`
    fetch(`/api/public/preview?${query}`, {
      headers: guestSession ? getGuestSessionHeaders(routeValue) : undefined,
    })
      .then(async (response) => {
        const preview = await response.json()
        if (!response.ok) throw new Error(preview.error || 'Failed to load preview')
        setData(preview)
      })
      .catch((fetchError: unknown) => {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load preview')
      })
      .finally(() => setLoading(false))
  }, [routeValue])

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
          <Link href="/upload" className="btn-primary-gradient inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-[14px]">
            Analyze a New Report
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    )
  }

  const visibleMedications = data.medications.slice(0, 2)
  const hiddenMedications = data.medications.slice(2)
  const visibleConditions = data.conditions.slice(0, 1)
  const hiddenConditions = data.conditions.slice(1)
  const visibleInsights = data.insights.slice(0, 2)
  const score = data.healthScore

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 glass-panel-strong border-b border-white/50">
        <div className="flex justify-between items-center px-4 sm:px-6 py-3 max-w-[900px] mx-auto">
          <div className="text-lg font-bold text-deep-navy tracking-tight">CareDesk</div>
          <Link
            href="/unlock"
            className="btn-primary-gradient px-4 sm:px-5 py-2 rounded-full font-bold text-[13px] active:scale-95 transition-transform"
          >
            Sign Up Free
          </Link>
        </div>
      </nav>

      <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="size-5 text-electric-blue" />
            <h1 className="text-[20px] sm:text-[24px] font-semibold text-deep-navy">Your Free Report Preview</h1>
          </div>
          <p className="text-[13px] text-on-surface-variant">
            {data.fileName} · {new Date(data.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <section className="glass-panel rounded-xl p-5 sm:p-6 mb-5 border border-electric-blue/10">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-container-low p-4">
              <div className="flex items-center gap-2 text-electric-blue">
                <Activity className="size-4" />
                <p className="text-[12px] font-semibold uppercase tracking-wide">Health score</p>
              </div>
              <p className="mt-2 text-[34px] font-bold text-deep-navy">{score ?? '—'}</p>
              {score != null && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
                  <div className="h-full rounded-full bg-gradient-to-r from-electric-blue to-secondary" style={{ width: `${score}%` }} />
                </div>
              )}
            </div>
            <div className="rounded-xl bg-surface-container-low p-4">
              <div className="flex items-center gap-2 text-secondary">
                <FileText className="size-4" />
                <p className="text-[12px] font-semibold uppercase tracking-wide">Conditions found</p>
              </div>
              <p className="mt-2 text-[34px] font-bold text-deep-navy">{data.conditions.length}</p>
              <p className="mt-2 text-[12px] text-on-surface-variant">from this report</p>
            </div>
          </div>
          {score != null && <p className="mt-3 text-[11px] text-on-surface-variant/70">This score is an educational summary, not a diagnosis.</p>}
        </section>

        <section className="glass-panel rounded-xl p-5 sm:p-6 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-electric-blue/10 flex items-center justify-center">
              <Sparkles className="size-4 text-electric-blue" />
            </div>
            <h2 className="text-[16px] font-semibold text-deep-navy">AI Summary</h2>
          </div>
          <p className="text-[15px] text-on-surface leading-[24px]">{data.summary}</p>
        </section>

        {visibleInsights.length > 0 && (
          <section className="glass-panel rounded-xl p-5 sm:p-6 mb-5 border border-secondary/15">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-5 text-secondary" />
              <h2 className="text-[16px] font-semibold text-deep-navy">Key insights</h2>
            </div>
            <ul className="space-y-2.5">
              {visibleInsights.map((insight, index) => (
                <li key={`${insight}-${index}`} className="flex items-start gap-2.5 text-[14px] leading-[21px] text-on-surface">
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-[11px] font-bold text-secondary">{index + 1}</span>
                  {insight}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="glass-panel rounded-xl p-5 sm:p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-semibold text-deep-navy">Health trends</h2>
            <span className="text-[12px] text-on-surface-variant">Preview</span>
          </div>
          <div className="relative h-40 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4">
            <div className="absolute inset-x-4 bottom-6 top-4 flex items-end gap-3 blur-[8px] select-none" aria-hidden="true">
              {[48, 72, 58, 86, 66, 92].map((height, index) => (
                <div key={index} className="flex-1 rounded-t-md bg-gradient-to-t from-electric-blue/60 to-secondary/50" style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="glass-panel-strong flex items-center gap-2 rounded-full border border-white/50 px-4 py-2">
                <Lock className="size-4 text-electric-blue" />
                <span className="text-[13px] font-semibold text-deep-navy">Sign up to view your health chart</span>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-xl p-5 sm:p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-semibold text-deep-navy">Lab results</h2>
            <span className="text-[12px] text-on-surface-variant">{data.labResults.length} extracted</span>
          </div>
          <div className="relative min-h-24 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
            <div className="space-y-2.5 blur-[7px] select-none" aria-hidden="true">
              {data.labResults.length > 0 ? data.labResults.map((lab, index) => (
                <div key={`${lab.test_name}-${index}`} className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2.5">
                  <span className="text-[14px] font-medium text-deep-navy">{lab.test_name}</span>
                  <span className="text-[14px] font-semibold text-deep-navy">{lab.value ?? '—'} {lab.unit || ''}</span>
                </div>
              )) : (
                <>
                  <div className="h-10 rounded-lg bg-surface-container-low" />
                  <div className="h-10 rounded-lg bg-surface-container-low" />
                  <div className="h-10 rounded-lg bg-surface-container-low" />
                </>
              )}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="glass-panel-strong flex items-center gap-2 rounded-full border border-white/50 px-4 py-2">
                <FlaskConical className="size-4 text-electric-blue" />
                <span className="text-[13px] font-semibold text-deep-navy">Unlock all lab details</span>
              </div>
            </div>
          </div>
        </section>

        {data.medications.length > 0 && (
          <section className="glass-panel rounded-xl p-5 sm:p-6 mb-5">
            <h2 className="text-[16px] font-semibold text-deep-navy mb-4">Medications</h2>
            <div className="space-y-2">
              {visibleMedications.map((medication, index) => (
                <div key={`${medication.name}-${index}`} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-container-low/50">
                  <div>
                    <span className="text-[14px] font-medium text-deep-navy">{medication.name}</span>
                    {medication.dose && <span className="text-[13px] text-on-surface-variant ml-2">{medication.dose}</span>}
                  </div>
                  {medication.frequency && <span className="text-[13px] text-on-surface-variant">{medication.frequency}</span>}
                </div>
              ))}
            </div>
            {hiddenMedications.length > 0 && (
              <div className="relative mt-2">
                <div className="blur-[6px] pointer-events-none select-none opacity-60 space-y-2" aria-hidden="true">
                  {hiddenMedications.map((medication, index) => (
                    <div key={`${medication.name}-${index}`} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-container-low/50">
                      <span className="text-[14px] font-medium text-deep-navy">{medication.name}</span>
                      <span className="text-[13px] text-on-surface-variant">{medication.frequency || ''}</span>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="glass-panel-strong px-4 py-2 rounded-full flex items-center gap-2 border border-white/40">
                    <Lock className="size-3.5 text-electric-blue" />
                    <span className="text-[12px] font-semibold text-deep-navy">{hiddenMedications.length} more</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {data.conditions.length > 0 && (
          <section className="glass-panel rounded-xl p-5 sm:p-6 mb-5">
            <h2 className="text-[16px] font-semibold text-deep-navy mb-4">Conditions</h2>
            <div className="space-y-2">
              {visibleConditions.map((condition, index) => (
                <div key={`${condition.name}-${index}`} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-container-low/50">
                  <span className="text-[14px] font-medium text-deep-navy">{condition.name}</span>
                  {condition.status && <span className="text-[12px] font-semibold uppercase text-on-surface-variant">{condition.status}</span>}
                </div>
              ))}
            </div>
            {hiddenConditions.length > 0 && (
              <div className="relative mt-2">
                <div className="blur-[6px] pointer-events-none select-none opacity-60 space-y-2" aria-hidden="true">
                  {hiddenConditions.map((condition, index) => (
                    <div key={`${condition.name}-${index}`} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-container-low/50">
                      <span className="text-[14px] font-medium text-deep-navy">{condition.name}</span>
                      <span className="text-[12px] uppercase text-on-surface-variant">{condition.status}</span>
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
          </section>
        )}

        <section className="glass-panel-strong organic-radius p-6 sm:p-8 text-center border-2 border-electric-blue/20">
          <div className="w-14 h-14 rounded-full bg-electric-blue/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="size-7 text-electric-blue" />
          </div>
          <h2 className="text-[20px] sm:text-[24px] font-semibold text-deep-navy mb-2">Want the full picture?</h2>
          <p className="text-[14px] text-on-surface-variant mb-6 max-w-md mx-auto">
            Sign up free to unlock every lab result, health trends, AI health chat, and secure family sharing.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/unlock" className="btn-primary-gradient inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full font-bold text-[15px] active:scale-[0.98] transition-transform">
              Sign Up — It&apos;s Free
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/upload" className="btn-glass inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-[14px]">
              Start a New Preview
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-on-surface-variant/60">No credit card required · Preview expires after 24 hours</p>
        </section>
      </main>
    </div>
  )
}
