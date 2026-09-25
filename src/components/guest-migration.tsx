'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@/components/clerk-shim'

export function GuestMigration() {
  const { isLoaded, isSignedIn } = useUser()
  const [migrating, setMigrating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoaded || !isSignedIn || migrating) return
    const sessionId = window.localStorage.getItem('guestSessionId')
    if (!sessionId) return
    setMigrating(true)
    void fetch('/api/public/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).then(async (response) => {
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || 'Migration failed')
      window.localStorage.removeItem('guestSessionId')
      window.localStorage.removeItem('caredesk_guest_preview')
      window.location.href = result.redirect || '/dashboard/reports'
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Your report could not be saved automatically.')
      setMigrating(false)
    })
  }, [isLoaded, isSignedIn, migrating])

  if (!migrating && !error) return null
  return <div className="mt-4 rounded-xl bg-surface-container-low p-3 text-sm text-on-surface-variant" role="status">{migrating ? 'Saving your report to your account…' : error}</div>
}
