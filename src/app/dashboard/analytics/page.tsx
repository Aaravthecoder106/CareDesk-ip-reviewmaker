'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/language-context'
import { BarChart3, RefreshCw, Loader2, TrendingUp, Pill, AlertCircle, FileText } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'

interface AnalyticsData {
  labTrends?: { test: string; values: { date: string; value: number; unit: string; flag: string }[] }[]
  medicationSummary?: { active: number; total: number }
  conditionSummary?: { active: number; resolved: number; chronic: number }
  reportStats?: { total: number; processed: number; pending: number }
  healthScore?: number
  insights?: string[]
}

interface FamilySnapshot {
  user_id: string
  name: string
  data: AnalyticsData
}

const COLORS = ['#0059bb', '#00E0FF', '#a9c7ff', '#002b5b']

export default function AnalyticsPage() {
  const { t } = useLanguage()
  const [ownData, setOwnData] = useState<AnalyticsData | null>(null)
  const [family, setFamily] = useState<FamilySnapshot[]>([])
  const [viewing, setViewing] = useState<string>('me')
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  async function fetchAnalytics() {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics/data')
      const json = await res.json()
      setOwnData(json.data || null)
      setFamily(json.family || [])
    } catch {
      console.error('Failed to fetch analytics')
    }
    setLoading(false)
  }

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const res = await fetch('/api/analytics/regenerate', { method: 'POST' })
      const json = await res.json()
      if (json.ok) setOwnData(json.data)
    } catch {
      console.error('Failed to regenerate')
    }
    setRegenerating(false)
  }

  const viewingFamily = family.find((f) => f.user_id === viewing)
  const data = viewing === 'me' ? ownData : viewingFamily?.data ?? null

  const labChartData = data?.labTrends?.flatMap(trend =>
    trend.values.map(v => ({
      name: trend.test,
      date: v.date,
      value: v.value,
      unit: v.unit,
    }))
  ) || []

  const conditionData = data?.conditionSummary
    ? [
        { name: t('analytics.chart.active'), value: data.conditionSummary.active || 0 },
        { name: t('analytics.chart.chronic'), value: data.conditionSummary.chronic || 0 },
        { name: t('analytics.chart.resolved'), value: data.conditionSummary.resolved || 0 },
      ].filter(d => d.value > 0)
    : []

  const reportData = data?.reportStats
    ? [
        { name: t('analytics.chart.processed'), value: data.reportStats.processed || 0 },
        { name: t('analytics.chart.pending'), value: data.reportStats.pending || 0 },
      ]
    : []

  const statCards = [
    { label: t('analytics.healthScore'), value: data?.healthScore || '—', icon: TrendingUp, color: 'text-secondary', bg: 'bg-secondary/10' },
    { label: t('analytics.activeMedications'), value: data?.medicationSummary?.active || 0, icon: Pill, color: 'text-electric-blue', bg: 'bg-electric-blue/10' },
    { label: t('analytics.conditions'), value: data?.conditionSummary?.active || 0, icon: AlertCircle, color: 'text-primary', bg: 'bg-primary/10' },
    { label: t('analytics.reports'), value: data?.reportStats?.total || 0, icon: FileText, color: 'text-secondary', bg: 'bg-secondary/10' },
  ]

  return (
    <div className="p-5 md:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] leading-[32px] font-semibold text-on-surface">{t('analytics.title')}</h1>
          <p className="mt-1 text-[14px] text-on-surface-variant">
            {t('analytics.subtitle')}
          </p>
        </div>
        {viewing === 'me' && (
          <Button onClick={handleRegenerate} disabled={regenerating} variant="outline" className="w-full sm:w-auto border-outline-variant/50 hover:bg-surface-container">
            {regenerating ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            {t('analytics.regenerate')}
          </Button>
        )}
      </div>

      {/* Family Tabs */}
      {family.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setViewing('me')}
            className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-all ${
              viewing === 'me'
                ? 'bg-primary text-white'
                : 'glass-panel text-on-surface-variant hover:bg-white/60'
            }`}
          >
            {t('analytics.myAnalytics')}
          </button>
          {family.map((f) => (
            <button
              key={f.user_id}
              onClick={() => setViewing(f.user_id)}
              className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-all ${
                viewing === f.user_id
                  ? 'bg-primary text-white'
                  : 'glass-panel text-on-surface-variant hover:bg-white/60'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-on-surface-variant" />
        </div>
      ) : !data ? (
        <div className="glass-panel organic-radius flex flex-col items-center justify-center py-16">
          <BarChart3 className="size-12 text-on-surface-variant/50" />
          <h3 className="mt-4 text-[16px] font-semibold text-deep-navy">{t('analytics.empty.title')}</h3>
          <p className="mt-1 text-[14px] text-on-surface-variant text-center max-w-sm">
            {viewing === 'me'
              ? t('analytics.empty.ownDesc')
              : t('analytics.empty.familyDesc', { name: viewingFamily?.name || 'They' })}
          </p>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
            {statCards.map((card) => (
              <div key={card.label} className="glass-panel organic-radius p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-bold tracking-wide uppercase text-on-surface-variant">{card.label}</span>
                  <div className={`w-8 h-8 rounded-full ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`size-4 ${card.color}`} />
                  </div>
                </div>
                <div className="text-[24px] font-bold text-deep-navy">{card.value}</div>
              </div>
            ))}
          </div>

          {/* AI Insights */}
          {data.insights && data.insights.length > 0 && (
            <div className="mb-6 glass-panel rounded-xl p-5 border border-electric-blue/10 ai-glow">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-secondary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-secondary">{t('analytics.aiInsights')}</span>
              </div>
              <ul className="space-y-2">
                {data.insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] text-on-surface">
                    <TrendingUp className="mt-0.5 size-4 shrink-0 text-secondary" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {labChartData.length > 0 && (
              <div className="glass-panel organic-radius p-5">
                <h3 className="text-[16px] font-semibold text-deep-navy mb-4">{t('analytics.labTrends')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={labChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#c4c6d0" />
                    <XAxis dataKey="name" fontSize={12} tick={{ fill: '#43474f' }} />
                    <YAxis fontSize={12} tick={{ fill: '#43474f' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0059bb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {conditionData.length > 0 && (
              <div className="glass-panel organic-radius p-5">
                <h3 className="text-[16px] font-semibold text-deep-navy mb-4">{t('analytics.conditions')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={conditionData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {conditionData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {reportData.length > 0 && (
              <div className="glass-panel organic-radius p-5">
                <h3 className="text-[16px] font-semibold text-deep-navy mb-4">{t('analytics.reportStatus')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={reportData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#c4c6d0" />
                    <XAxis dataKey="name" fontSize={12} tick={{ fill: '#43474f' }} />
                    <YAxis fontSize={12} tick={{ fill: '#43474f' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0059bb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {labChartData.length > 1 && (
              <div className="glass-panel organic-radius p-5">
                <h3 className="text-[16px] font-semibold text-deep-navy mb-4">{t('analytics.labTimeline')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={labChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#c4c6d0" />
                    <XAxis dataKey="date" fontSize={12} tick={{ fill: '#43474f' }} />
                    <YAxis fontSize={12} tick={{ fill: '#43474f' }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#0059bb" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
