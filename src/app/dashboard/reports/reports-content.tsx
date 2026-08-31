'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/language-context'
import { FolderOpen, Upload, Trash2, RefreshCw, FileText, Loader2, Lock, Eye } from 'lucide-react'

interface Report {
  id: string
  title: string
  file_path: string
  mime_type: string | null
  ai_summary: string | null
  status: string
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-amber-600',
  processing: 'text-blue-600',
  ready: 'text-green-600',
  failed: 'text-destructive',
}

const STATUS_BG: Record<string, string> = {
  pending: 'bg-amber-50 border-amber-200',
  processing: 'bg-blue-50 border-blue-200',
  ready: 'bg-green-50 border-green-200',
  failed: 'bg-red-50 border-red-200',
}

/** Files over this size use presigned URL upload to bypass Vercel body limit. */
const PRESIGN_THRESHOLD = 3 * 1024 * 1024 // 3 MB

export default function ReportsPage() {
  const { t } = useLanguage()
  const [locked, setLocked] = useState<boolean | null>(null)
  const [gatePassword, setGatePassword] = useState('')
  const [gateError, setGateError] = useState('')
  const [unlocking, setUnlocking] = useState(false)

  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/library/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status' }),
        })
        const data = await res.json()
        setLocked(!!data.locked)
      } catch {
        setLocked(false)
      }
    })()
  }, [])

  const fetchReports = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const res = await fetch('/api/reports/list')
      const data = await res.json()
      if (data.error) setError(data.error)
      setReports(data.reports || [])
    } catch {
      setError(t('reports.errors.fetchFailed'))
    }
    if (showSpinner) setLoading(false)
  }, [t])

  useEffect(() => {
    if (locked === false) fetchReports()
  }, [locked, fetchReports])

  useEffect(() => {
    const busy = reports.some((r) => r.status === 'pending' || r.status === 'processing')
    if (!busy) return
    const t2 = setInterval(() => fetchReports(false), 4000)
    return () => clearInterval(t2)
  }, [reports, fetchReports])

  async function handleUnlock() {
    setUnlocking(true)
    setGateError('')
    try {
      const res = await fetch('/api/library/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', password: gatePassword }),
      })
      const data = await res.json()
      if (data.ok) setLocked(false)
      else setGateError(t('reports.errors.incorrectPassword'))
    } catch {
      setGateError(t('reports.errors.verificationFailed'))
    }
    setUnlocking(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    setUploadProgress('')

    try {
      if (file.size > PRESIGN_THRESHOLD) {
        setUploadProgress('Preparing upload...')
        const presignRes = await fetch('/api/reports/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size }),
        })
        const presignData = await presignRes.json()
        if (!presignData.ok) throw new Error(presignData.error || 'Failed to get upload URL')

        setUploadProgress('Uploading file...')
        const uploadRes = await fetch(presignData.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        })
        if (!uploadRes.ok) throw new Error(`Direct upload failed: ${uploadRes.statusText}`)

        setUploadProgress('Finalizing...')
        const finalizeRes = await fetch('/api/reports/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: presignData.filePath,
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
            fileSize: file.size,
          }),
        })
        const finalizeData = await finalizeRes.json()
        if (finalizeData.ok) {
          setReports(prev => [finalizeData.report, ...prev])
        } else {
          setError(finalizeData.error || t('reports.errors.uploadFailed'))
        }
      } else {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/reports/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.ok) {
          setReports(prev => [data.report, ...prev])
        } else {
          setError(data.error || t('reports.errors.uploadFailed'))
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Upload failed: ${msg}`)
      console.error('Upload error:', err)
    }
    setUploading(false)
    setUploadProgress('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/reports/delete?id=${id}`, { method: 'DELETE' })
      setReports(prev => prev.filter(r => r.id !== id))
    } catch {
      console.error('Delete failed')
    }
  }

  async function handleReanalyze(id: string) {
    setAnalyzing(id)
    setError('')
    try {
      const res = await fetch('/api/reports/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id }),
      })
      const data = await res.json()
      if (data.error || data.ok === false) setError(data.error || t('reports.errors.analysisFailed'))
      fetchReports()
    } catch {
      setError(t('reports.errors.analysisFailed'))
    }
    setAnalyzing(null)
  }

  async function handlePreview(id: string) {
    setError('')
    try {
      const res = await fetch(`/api/reports/preview?id=${id}`)
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      } else {
        setError(data.error || t('reports.errors.previewFailed'))
      }
    } catch {
      setError(t('reports.errors.previewFailed'))
    }
  }

  if (locked === null) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-8 animate-spin text-on-surface-variant" />
      </div>
    )
  }

  if (locked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="glass-panel organic-radius w-full max-w-sm p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="size-8 text-primary/70" />
            </div>
            <div className="text-center">
              <h2 className="text-[18px] font-semibold text-deep-navy">{t('reports.locked.title')}</h2>
              <p className="mt-1 text-[14px] text-on-surface-variant">
                {t('reports.locked.desc')}
              </p>
            </div>
            <input
              type="password"
              value={gatePassword}
              onChange={(e) => setGatePassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              placeholder={t('reports.locked.placeholder')}
              className="w-full rounded-lg bg-white/50 border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
              autoFocus
            />
            {gateError && <p className="text-sm text-destructive">{gateError}</p>}
            <Button className="w-full btn-primary-gradient" onClick={handleUnlock} disabled={unlocking || !gatePassword}>
              {unlocking ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Lock className="mr-2 size-4" />}
              {t('reports.locked.unlock')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] leading-[32px] font-semibold text-on-surface">{t('reports.title')}</h1>
          <p className="mt-1 text-[14px] text-on-surface-variant">
            {t('reports.subtitle')}
          </p>
        </div>
        <div className="shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleUpload}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary-gradient w-full sm:w-auto">
            {uploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {uploading && uploadProgress ? uploadProgress : t('reports.upload')}
          </Button>
        </div>
      </div>

      {/* AI Summary Overview */}
      <div className="mb-6 glass-panel rounded-xl p-4 border border-electric-blue/10 ai-glow">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-secondary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-secondary">AI Health Overview</span>
        </div>
        <p className="text-[16px] text-on-surface">
          Based on your recent reports, AI analysis provides personalized insights for your health journey.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 glass-panel rounded-xl p-4 border border-destructive/30">
          <p className="text-[14px] text-destructive">{error}</p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-on-surface-variant" />
        </div>
      ) : reports.length === 0 ? (
        <div className="glass-panel organic-radius flex flex-col items-center justify-center py-16">
          <FolderOpen className="size-12 text-on-surface-variant/50" />
          <h3 className="mt-4 text-[16px] font-semibold text-deep-navy">{t('reports.empty.title')}</h3>
          <p className="mt-1 text-[14px] text-on-surface-variant">
            {t('reports.empty.desc')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className={`glass-panel rounded-xl p-4 hover:bg-white/60 transition-all duration-200 cursor-pointer border ${report.status === 'failed' ? 'border-destructive/30' : 'border-outline-variant/30'} relative overflow-hidden`}>
              {report.status === 'failed' && (
                <div className="absolute top-0 left-0 w-1 h-full bg-destructive"></div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                    <FileText className="size-5 text-secondary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-[16px] font-semibold text-deep-navy">{report.title}</h3>
                    <p className="text-[12px] text-on-surface-variant">
                      {new Date(report.created_at).toLocaleDateString()}
                      <span className={`ml-2 capitalize ${STATUS_STYLES[report.status] || ''}`}>
                        {report.status === 'ready' ? t('reports.status.analyzed') : report.status}
                        {(report.status === 'pending' || report.status === 'processing') && (
                          <Loader2 className="ml-1 inline size-3 animate-spin" />
                        )}
                      </span>
                    </p>
                    {report.ai_summary && (
                      <div className="mt-2 bg-electric-blue/5 rounded-lg p-2.5 border border-electric-blue/10">
                        <p className="text-[14px] text-on-surface line-clamp-2">
                          {report.ai_summary}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handlePreview(report.id)}
                    title={t('reports.viewDocument')}
                    className="hover:bg-surface-container"
                  >
                    <Eye className="size-4 text-on-surface-variant" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleReanalyze(report.id)}
                    disabled={analyzing === report.id}
                    title={t('reports.reanalyze')}
                    className="hover:bg-surface-container"
                  >
                    {analyzing === report.id ? (
                      <Loader2 className="size-4 animate-spin text-secondary" />
                    ) : (
                      <RefreshCw className="size-4 text-on-surface-variant" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(report.id)}
                    className="hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
