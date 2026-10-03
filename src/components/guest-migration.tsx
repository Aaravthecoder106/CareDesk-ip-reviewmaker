'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

const STORAGE_KEY = 'caredesk_preview_token'

type MigrationState = 'idle' | 'migrating' | 'success' | 'error'

interface MigrateResponse {
  success?: boolean
  reportId?: string | null
  redirect?: string
  alreadyMigrated?: boolean
  duplicate?: boolean
  error?: string
}

/**
 * GuestMigration — runs once after a guest signs up.
 *
 * Checks localStorage for a saved preview token (set when the guest viewed
 * their teaser analysis). If found and the user is now authenticated,
 * calls POST /api/public/migrate to move the guest data into their account.
 *
 * Retry policy:
 *   - Terminal outcomes (success, 404 gone, 409 owned elsewhere, 410 expired)
 *     consume the token and latch the attempt for this tab.
 *   - Retryable outcomes (401 while the session settles, 425 analysis still
 *     running, 5xx, network errors) release the latch so the next load of an
 *     authenticated page tries again instead of failing forever.
 *
 * Mount it in the dashboard layout so it fires on first authenticated page load.
 */
export function GuestMigration() {
  const router = useRouter()
  const [state, setState] = useState<MigrationState>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY)
    if (!token) return // No guest session — nothing to migrate

    // Prevent concurrent duplicate attempts (two mounts of this component).
    // Released again on retryable failures.
    const attemptKey = `${STORAGE_KEY}_attempted_${token}`
    if (sessionStorage.getItem(attemptKey)) return
    sessionStorage.setItem(attemptKey, '1')

    async function runMigration() {
      setState('migrating')
      setMessage('Migrating your report…')

      try {
        const res = await fetch('/api/public/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ previewToken: token }),
        })

        let data: MigrateResponse = {}
        try {
          data = (await res.json()) as MigrateResponse
        } catch {
          data = {}
        }

        // Not signed in (or the session cookie has not settled yet).
        // Keep the token, release the latch — retried on the next load.
        if (res.status === 401) {
          sessionStorage.removeItem(attemptKey)
          setState('idle')
          return
        }

        if (res.ok && data.success) {
          localStorage.removeItem(STORAGE_KEY)
          sessionStorage.setItem(attemptKey, '1')

          if (data.alreadyMigrated || data.duplicate) {
            setMessage('Report already in your library!')
          } else {
            setMessage('Report migrated successfully!')
          }
          setState('success')

          // Brief pause to show success, then navigate to the Report Library.
          setTimeout(() => {
            setState('idle')
            router.push(data.redirect || '/dashboard/reports')
            router.refresh() // Refresh server data
          }, 1500)
          return
        }

        // ── Terminal failure modes: consume the token, do not retry ─────
        if (res.status === 404 || res.status === 409) {
          localStorage.removeItem(STORAGE_KEY)
          sessionStorage.setItem(attemptKey, '1')
          setState('idle')
          return
        }

        if (res.status === 410) {
          localStorage.removeItem(STORAGE_KEY)
          sessionStorage.setItem(attemptKey, '1')
          setMessage('Your preview session expired. Upload a new report.')
          setState('error')
          setTimeout(() => setState('idle'), 4000)
          return
        }

        // ── Retryable failure modes: release the latch, keep the token ──
        sessionStorage.removeItem(attemptKey)
        setMessage(
          data.error ||
            'Migration failed. It will retry automatically — you can also reload the page.',
        )
        setState('error')
        setTimeout(() => setState('idle'), 5000)
      } catch {
        // Network error — retryable.
        sessionStorage.removeItem(attemptKey)
        setMessage('Network error while migrating. Reload the page to retry.')
        setState('error')
        setTimeout(() => setState('idle'), 5000)
      }
    }

    runMigration()
  }, [router])

  if (state === 'idle') return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className={`glass-panel-strong rounded-xl px-5 py-4 shadow-xl border max-w-sm flex items-center gap-3
        ${state === 'success' ? 'border-green-300/50' : state === 'error' ? 'border-destructive/30' : 'border-electric-blue/30'}
      `}>
        {state === 'migrating' && (
          <Loader2 className="size-5 animate-spin text-electric-blue shrink-0" />
        )}
        {state === 'success' && (
          <CheckCircle2 className="size-5 text-green-600 shrink-0" />
        )}
        {state === 'error' && (
          <AlertCircle className="size-5 text-destructive shrink-0" />
        )}
        <p className="text-[14px] text-deep-navy font-medium">{message}</p>
      </div>
    </div>
  )
}

/**
 * Helper to store the preview token in localStorage.
 * Call this from the preview page when the user views their analysis.
 */
export function savePreviewTokenForMigration(token: string) {
  if (typeof window !== 'undefined' && token && token !== 'inline') {
    localStorage.setItem(STORAGE_KEY, token)
  }
}
