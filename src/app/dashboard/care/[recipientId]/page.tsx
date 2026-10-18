'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowLeft, Activity, AlertTriangle, RefreshCw, Send } from 'lucide-react'

type Reading = {
  id: string
  vital_type: 'blood_pressure' | 'glucose' | 'weight'
  systolic: number | null
  diastolic: number | null
  glucose_mg_dl: number | string | null
  weight_kg: number | string | null
  measured_at: string
}

type ChartPoint = { date: string; value: number }

function chartSeries(readings: Reading[], type: Reading['vital_type']): ChartPoint[] {
  return readings
    .filter((reading) => reading.vital_type === type)
    .flatMap((reading) => {
      const rawValue = type === 'blood_pressure'
        ? reading.systolic
        : type === 'glucose'
          ? reading.glucose_mg_dl
          : reading.weight_kg
      if (rawValue === null || rawValue === undefined || rawValue === '') return []
      const value = Number(rawValue)
      if (!Number.isFinite(value)) return []
      return [{
        date: new Date(reading.measured_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }),
        value,
      }]
    })
}

function TrendChart({ title, unit, data }: { title: string; unit: string; data: ChartPoint[] }) {
  return (
    <section className="rounded-2xl border border-outline-variant/60 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-deep-navy">{title}</h2>
      <p className="mt-1 text-xs text-on-surface-variant">Recorded values only · {unit}</p>
      {data.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-outline-variant p-5 text-sm text-on-surface-variant">
          No readings recorded in the last 90 days.
        </p>
      ) : (
        <div className="mt-4 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis width={42} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" name={title} stroke="currentColor" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

export default function CareCheckInPage() {
  const params = useParams<{ recipientId: string }>()
  const recipientId = params.recipientId
  const [name, setName] = useState('')
  const [readings, setReadings] = useState<Reading[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/care/check-ins?recipientId=' + encodeURIComponent(recipientId), { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not load this care profile.')
      setName(result.recipient.full_name)
      setReadings(Array.isArray(result.readings) ? result.readings : [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load this care profile.')
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }, [recipientId])

  useEffect(() => { void load() }, [load])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setIsError(false)
    try {
      const response = await fetch('/api/care/check-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId, text }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not save this check-in.')
      setText('')
      setMessage(`Saved ${result.saved} reading(s). Charts show recorded values, not a diagnosis.`)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this check-in.')
      setIsError(true)
    } finally {
      setSaving(false)
    }
  }

  const bp = chartSeries(readings, 'blood_pressure')
  const glucose = chartSeries(readings, 'glucose')
  const weight = chartSeries(readings, 'weight')

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 p-5 md:p-8 lg:p-10">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Family Care Dashboard
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Care check-ins</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-deep-navy sm:text-3xl">
            {name ? name + ' — check-ins and trends' : 'Check-ins and trends'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Enter only values you have actually measured. CareDesk records the readings you mention and does not infer missing values or provide a diagnosis.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
          <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} aria-hidden="true" /> Refresh
        </button>
      </header>

      <section className="rounded-2xl border border-outline-variant/60 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity className="h-5 w-5" aria-hidden="true" /></div>
          <div>
            <h2 className="font-semibold text-deep-navy">Add a natural-language check-in</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Example: “BP 120/80, blood sugar 110 mg/dL, weight 65 kg”. You can enter one or more readings.</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="check-in-text" className="block text-sm font-medium text-deep-navy">What was measured?</label>
          <textarea id="check-in-text" required maxLength={500} rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder="BP 120/80, sugar 110, weight 65 kg" className="w-full rounded-xl border border-outline-variant bg-white px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
          <p className="text-xs leading-5 text-on-surface-variant">Supported formats: BP 120/80; sugar 110; weight 65 kg. Unrecognized text is rejected rather than guessed. Enter readings only with the parent’s active consent.</p>
          <button type="submit" disabled={saving || !text.trim()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            <Send className="h-4 w-4" aria-hidden="true" /> {saving ? 'Saving…' : 'Save check-in'}
          </button>
        </form>
        {message && <p role={isError ? 'alert' : 'status'} className={'mt-4 rounded-xl border p-3 text-sm ' + (isError ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900')}>{isError && <AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true" />}{message}</p>}
      </section>

      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold text-deep-navy">90-day trends</h2><p className="mt-1 text-sm text-on-surface-variant">Only stored readings are plotted. Blood pressure charts show systolic values.</p></div>
        <span className="text-xs text-on-surface-variant">{loading ? 'Loading…' : readings.length + ' recorded readings'}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart title="Blood pressure (systolic)" unit="mmHg" data={bp} />
        <TrendChart title="Blood sugar" unit="mg/dL" data={glucose} />
        <TrendChart title="Weight" unit="kg" data={weight} />
      </div>
    </div>
  )
}
