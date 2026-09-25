'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, Lock, ShieldCheck, Sparkles } from 'lucide-react'

interface GuestPreview {
  fileName?: string
  summary?: string
  healthScore?: number | null
  conditions?: unknown[]
  insights?: string[]
}

export default function SignupConversionPage() {
  const [data, setData] = useState<GuestPreview | null>(null)

  useEffect(() => {
    const raw = window.localStorage.getItem('caredesk_guest_preview')
    if (raw) {
      try { setData(JSON.parse(raw) as GuestPreview) } catch { window.localStorage.removeItem('caredesk_guest_preview') }
    }
  }, [])

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-on-surface sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[15px] font-semibold text-on-surface-variant hover:bg-surface-container">
          <ArrowRight className="size-5 rotate-180" /> Back to CareDesk
        </Link>
        <div className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <section className="glass-panel organic-radius p-5 sm:p-8">
            <div className="flex items-center gap-2 text-electric-blue"><Sparkles className="size-5" /><span className="text-[14px] font-bold uppercase tracking-wider">Your free preview</span></div>
            <h1 className="mt-3 text-[27px] font-bold leading-[35px] text-deep-navy sm:text-[34px] sm:leading-[42px]">See the full picture of your health</h1>
            {data?.summary && <p className="mt-4 text-[16px] leading-7 text-on-surface">{data.summary}</p>}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-surface-container-low p-4"><p className="text-[12px] text-on-surface-variant">Health score</p><p className="mt-1 text-[28px] font-bold text-deep-navy">{data?.healthScore ?? '—'}</p></div>
              <div className="rounded-2xl bg-surface-container-low p-4"><p className="text-[12px] text-on-surface-variant">Conditions</p><p className="mt-1 text-[28px] font-bold text-deep-navy">{data?.conditions?.length ?? '—'}</p></div>
              <div className="col-span-2 rounded-2xl bg-surface-container-low p-4 sm:col-span-1"><p className="text-[12px] text-on-surface-variant">Key insights</p><p className="mt-1 text-[18px] font-bold text-deep-navy">{data?.insights?.length ?? 2} found</p></div>
            </div>
            <div className="mt-6 rounded-2xl border border-outline-variant/50 p-4 sm:p-5">
              <div className="flex items-center gap-2 font-semibold text-deep-navy"><Lock className="size-4 text-electric-blue" /> Unlock with a free account</div>
              <div className="mt-4 space-y-2 blur-[5px] select-none" aria-hidden="true"><div className="h-4 w-4/5 rounded bg-surface-container-highest" /><div className="h-4 w-3/5 rounded bg-surface-container-highest" /><div className="h-4 w-2/3 rounded bg-surface-container-highest" /></div>
            </div>
          </section>
          <section className="glass-panel-strong organic-radius border-2 border-electric-blue/20 p-5 sm:p-8">
            <div className="flex items-center gap-2"><ShieldCheck className="size-6 text-secondary" /><h2 className="text-[22px] font-bold text-deep-navy">Create your free account</h2></div>
            <p className="mt-2 text-[15px] leading-6 text-on-surface-variant">Your report moves into your account automatically. No re-upload.</p>
            <div className="mt-5 rounded-2xl bg-surface-container-lowest p-2"><Link href="/sign-up" className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-electric-blue px-5 text-[17px] font-bold text-white">Create free account <ArrowRight className="size-5" /></Link></div>
            <div className="mt-5 space-y-2 text-[13px] text-on-surface-variant"><p className="flex gap-2"><CheckCircle2 className="size-4 text-secondary" />2 lifetime reports on Free Explorer</p><p className="flex gap-2"><CheckCircle2 className="size-4 text-secondary" />Full insights, trends, and AI chat</p><p className="flex gap-2"><CheckCircle2 className="size-4 text-secondary" />Your first upload is included</p></div>
          </section>
        </div>
        <p className="mt-5 text-center text-[13px] text-on-surface-variant">Already have an account? <Link href="/sign-in" className="font-semibold text-electric-blue underline">Sign in</Link></p>
      </div>
    </main>
  )
}
