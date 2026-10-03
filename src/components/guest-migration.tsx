'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

const STORAGE_KEY = 'caredesk_preview_token'

type MigrationState = 'idle' | 'migrating' | 'success' | 'error'

/**
 * GuestMigration — runs once after a guest signs up.
 *
 * Checks localStorage for a saved preview token (set when the guest viewed
 * their teaser analysis). If found and the user is now authenticated,
 * calls POST /api/public/migrate to move the guest data into their account.
 *
 * This component renders a small overlay during migration and auto-dismisses.
 * Mount it in the dashboard layout so it fires on first authenticated page load.
 */
export function GuestMigration() {
  const router = useRouter()
  const [state, setState] = useState<MigrationState>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY)
    if (!token) return // No guest session — nothing to migrate

    // Prevent duplicate migration attempts
    const migrationAttemptKey = `${STORAGE_KEY}_attempted_${token}`
    if (sessionStorage.getItem(migrationAttemptKey)) return
    sessionStorage.setItem(migrationAttemptKey, '1')

    async function runMigration() {
      setState('migrating')
      setMessage('Migrating your report…')

      try {
        const res = await fetch('/api/public/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ previewToken: token }),
        })

        const data = await res.json()

        if (data.success) {
          // Clean up localStorage
          localStorage.removeItem(STORAGE_KEY)

          if (data.alreadyMigrated) {
            setMessage('Report already in your library!')
          } else {
            setMessage('Report migrated successfully!')
          }
          setState('success')

          // Brief pause to show success, then navigate
          setTimeout(() => {
            setState('idle')
            router.push(data.redirect || '/dashboard/reports')
            router.refresh() // Refresh server data
          }, 1500)
        } else {
          // Handle specific error cases
          if (res.status === 410) {
            // Expired
            localStorage.removeItem(STORAGE_KEY)
            setMessage('Your preview session expired. Upload a new report.')
            setState('error')
            setTimeout(() => setState('idle'), 4000)
          } else if (res.status === 409) {
            // Already migrated to another account
            localStorage.removeItem(STORAGE_KEY)
            setState('idle')
          } else if (res.status === 404) {
            // Token not found — maybe stale localStorage
            localStorage.removeItem(STORAGE_KEY)
            setState('idle')
          } else {
            setMessage(data.error || 'Migration failed. You can upload again from the dashboard.')
            setState('error')
            setTimeout(() => setState('idle'), 5000)
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error'
        setMessage(`Migration failed: ${msg}`)
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
