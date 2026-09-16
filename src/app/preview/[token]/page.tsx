'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Lock, FileText, ArrowRight, CheckCircle2, AlertTriangle, AlertCircle, XCircle, Shield } from 'lucide-react'

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
  labResults: LabResult[]
  medications: Medication[]
  conditions: Condition[]
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
          const d = JSON.parse(raw)
          setData({
            fileName: d.fileName || 'Report',
            summary: d.summary,
            labResults: d.labResults || [],
            medications: d.medications || [],
            conditions: d.conditions || [],
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
          setData(d)
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
          <div className="text-lg font-bold text-deep-navy tracking-tight">CareDesk</div>
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

        {/* Summary — fully visible */}
        <div className="glass-panel rounded-xl p-5 sm:p-6 mb-5 border border-electric-blue/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-electric-blue/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-electric-blue text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <h2 className="text-[16px] font-semibold text-deep-navy">AI Summary</h2>
          </div>
          <p className="text-[15px] text-on-surface leading-[24px]">{data.summary}</p>
        </div>

        {/* Lab Results */}
        <div className="glass-panel rounded-xl p-5 sm:p-6 mb-5">
          <h2 className="text-[16px] font-semibold text-deep-navy mb-4">Lab Results</h2>
          {visibleLabs.length > 0 ? (
            <div className="space-y-2.5">
              {visibleLabs.map((lab, i) => {
                const Icon = FLAG_ICONS[lab.flag || 'normal'] || CheckCircle2
                const colorClass = FLAG_COLORS[lab.flag || 'normal'] || FLAG_COLORS.normal
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
