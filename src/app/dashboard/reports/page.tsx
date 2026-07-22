'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

export default function ReportsPage() {
  // Password gate: null = checking, true = locked (needs password), false = open
  const [locked, setLocked] = useState<boolean | null>(null)
  const [gatePassword, setGatePassword] = useState('')
  const [gateError, setGateError] = useState('')
  const [unlocking, setUnlocking] = useState(false)

  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
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
      setError('Failed to fetch reports')
    }
    if (showSpinner) setLoading(false)
  }, [])

  useEffect(() => {
    if (locked === false) fetchReports()
  }, [locked, fetchReports])

  // Poll while any report is pending/processing so summaries appear when done.
  useEffect(() => {
    const busy = reports.some((r) => r.status === 'pending' || r.status === 'processing')
    if (!busy) return
    const t = setInterval(() => fetchReports(false), 4000)
    return () => clearInterval(t)
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
      else setGateError('Incorrect password')
    } catch {
      setGateError('Verification failed')
    }
    setUnlocking(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/reports/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.ok) {
        setReports(prev => [data.report, ...prev])
      } else {
        setError(data.error || 'Upload failed')
      }
    } catch {
      setError('Upload failed')
    }
    setUploading(false)
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
      if (data.error || data.ok === false) setError(data.error || 'Analysis failed')
      fetchReports()
    } catch {
      setError('Analysis failed')
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
        setError(data.error || 'Failed to open preview')
      }
    } catch {
      setError('Failed to open preview')
    }
  }

  if (locked === null) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (locked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <Lock className="size-10 text-primary/70" />
            <div className="text-center">
              <h2 className="font-semibold">Library Locked</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your library password to view your reports.
              </p>
            </div>
            <input
              type="password"
              value={gatePassword}
              onChange={(e) => setGatePassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              placeholder="Library password"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            {gateError && <p className="text-sm text-destructive">{gateError}</p>}
            <Button className="w-full" onClick={handleUnlock} disabled={unlocking || !gatePassword}>
              {unlocking ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Lock className="mr-2 size-4" />}
              Unlock
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Report Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload, organize, and search your medical reports.
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
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full sm:w-auto">
            {uploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            Upload Report
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-4 border-destructive/50">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="size-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-medium">No reports yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your first medical report to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <FileText className="size-8 shrink-0 text-primary/70" />
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{report.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {new Date(report.created_at).toLocaleDateString()}
                      <span className={`ml-2 capitalize ${STATUS_STYLES[report.status] || ''}`}>
                        {report.status === 'ready' ? 'Analyzed' : report.status}
                        {(report.status === 'pending' || report.status === 'processing') && (
                          <Loader2 className="ml-1 inline size-3 animate-spin" />
                        )}
                      </span>
                    </p>
                    {report.ai_summary && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {report.ai_summary}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handlePreview(report.id)}
                    title="View Document"
                  >
                    <Eye className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleReanalyze(report.id)}
                    disabled={analyzing === report.id}
                    title="Re-analyze"
                  >
                    {analyzing === report.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(report.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
