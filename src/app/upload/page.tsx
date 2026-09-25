'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { ArrowLeft, Camera, FileText, Loader2, Upload } from 'lucide-react'
import { getGuestSessionHeaders, getOrCreateGuestSessionId, isGuestSessionId, saveGuestSessionId } from '@/lib/guest-session'

const MAX_FILE_SIZE = 20 * 1024 * 1024

export default function GuestUploadPage() {
  const [sessionId, setSessionId] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  async function analyze(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      setError('This file is larger than 20 MB. Please choose a smaller report.')
      return
    }
    if (!/^(application\/pdf|image\/(jpeg|jpg|png|webp|heic|heif))$/i.test(file.type)) {
      setError('Please choose a PDF, JPG, PNG, or WebP report.')
      return
    }

    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)

    try {
      const activeSessionId = isGuestSessionId(sessionId) ? sessionId : getOrCreateGuestSessionId()
      setSessionId(activeSessionId)
      const response = await fetch('/api/public/analyze', {
        method: 'POST',
        headers: getGuestSessionHeaders(activeSessionId),
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        if (response.status === 409 || response.status === 429) {
          setError('You have already used your free guest analysis. Create a free account to continue.')
          return
        }
        setError(data.error || 'We could not analyze that report. Please try again.')
        return
      }
      if (typeof data.sessionId === 'string' && isGuestSessionId(data.sessionId)) {
        saveGuestSessionId(data.sessionId)
        window.localStorage.setItem('caredesk_guest_preview', JSON.stringify(data.data || {}))
        window.location.href = `/preview/${data.sessionId}`
        return
      }
      setError('The report was received but no preview was returned. Please try again.')
    } catch {
      setError('We could not reach the analysis service. Check your connection and try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void analyze(file)
  }

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-on-surface sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[15px] font-semibold text-on-surface-variant hover:bg-surface-container">
          <ArrowLeft className="size-5" aria-hidden="true" />
          Back
        </Link>

        <section className="mt-8 text-center sm:mt-12">
          <p className="text-[14px] font-bold uppercase tracking-[0.12em] text-electric-blue">Free report check</p>
          <h1 className="mt-3 text-[30px] font-bold leading-[38px] text-deep-navy sm:text-[40px] sm:leading-[48px]">Analyze your report</h1>
          <p className="mx-auto mt-3 max-w-xl text-[17px] leading-7 text-on-surface-variant sm:text-[19px]">
            Take a clear photo or choose a PDF. No account is needed to see your first results.
          </p>
        </section>

        <section className="glass-panel organic-radius mt-8 p-4 sm:mt-10 sm:p-8" aria-label="Report upload">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void analyze(file)
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void analyze(file)
            }}
          />
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click() }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 text-center transition-colors sm:min-h-[320px] ${dragging ? 'border-electric-blue bg-electric-blue/10' : 'border-outline-variant bg-surface-container-low/40 hover:border-electric-blue hover:bg-surface-container-low/70'} ${uploading ? 'pointer-events-none opacity-70' : ''}`}
          >
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-electric-blue/10">
              {uploading ? <Loader2 className="size-8 animate-spin text-electric-blue" /> : <Upload className="size-8 text-electric-blue" />}
            </div>
            <h2 className="text-[20px] font-bold text-deep-navy sm:text-[24px]">{uploading ? 'Reading your report…' : 'Drop your report here'}</h2>
            <p className="mt-2 text-[15px] leading-6 text-on-surface-variant">PDF, JPG, PNG or WebP · up to 20 MB</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 text-[14px] text-on-surface-variant">
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-container px-4 font-semibold"><FileText className="size-4" />Choose a file</span>
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-electric-blue/10 px-4 font-semibold text-electric-blue"><Camera className="size-4" />Take a photo</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-electric-blue px-5 text-[17px] font-bold text-white sm:hidden"
          >
            <Camera className="size-5" />
            Take a photo of your report
          </button>
          {error && <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-[15px] font-medium text-destructive" role="alert">{error}</p>}
        </section>

        <p className="mx-auto mt-5 max-w-2xl text-center text-[13px] leading-5 text-on-surface-variant">
          Your report is used only to create this preview. We save it temporarily so you can return within 48 hours.
        </p>
        <p className="mt-4 text-center text-[13px] text-on-surface-variant/70">Already have an account? <Link href="/sign-in" className="font-semibold text-electric-blue underline">Sign in</Link></p>
      </div>
    </main>
  )
}
