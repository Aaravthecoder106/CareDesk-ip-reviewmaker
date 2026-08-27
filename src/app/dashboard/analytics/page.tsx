'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6']

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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{t('analytics.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('analytics.subtitle')}
          </p>
        </div>
        {viewing === 'me' && (
          <Button onClick={handleRegenerate} disabled={regenerating} variant="outline" className="w-full sm:w-auto">
            {regenerating ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            {t('analytics.regenerate')}
          </Button>
        )}
      </div>

      {family.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Button
            variant={viewing === 'me' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewing('me')}
          >
            {t('analytics.myAnalytics')}
          </Button>
          {family.map((f) => (
            <Button
              key={f.user_id}
              variant={viewing === f.user_id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewing(f.user_id)}
            >
              {f.name}
            </Button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="size-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-medium">{t('analytics.empty.title')}</h3>
            <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
              {viewing === 'me'
                ? t('analytics.empty.ownDesc')
                : t('analytics.empty.familyDesc', { name: viewingFamily?.name || 'They' })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Health Score */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('analytics.healthScore')}</CardTitle>
                <TrendingUp className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.healthScore || '—'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('analytics.activeMedications')}</CardTitle>
                <Pill className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.medicationSummary?.active || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('analytics.conditions')}</CardTitle>
                <AlertCircle className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.conditionSummary?.active || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('analytics.reports')}</CardTitle>
                <FileText className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.reportStats?.total || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Insights */}
          {data.insights && data.insights.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t('analytics.aiInsights')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <TrendingUp className="mt-0.5 size-4 shrink-0 text-primary" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {labChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">{t('analytics.labTrends')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={labChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {conditionData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">{t('analytics.conditions')}</CardTitle>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            )}

            {reportData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">{t('analytics.reportStatus')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={reportData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {labChartData.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">{t('analytics.labTimeline')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={labChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}
