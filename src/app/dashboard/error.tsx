'use client'

import { useEffect } from 'react'

/**
 * Error boundary for /dashboard (M5).
 *
 * The DAL (getCurrentUser / getCurrentPatient / ensureCurrentUserProvisioned)
 * throws on any Supabase/RLS/provisioning error. Without a boundary those turn
 * the core authenticated page into an unhandled 500. This degrades gracefully
 * and offers a retry (Next re-renders the segment on reset()).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard] render error:', error)
  }, [error])

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <section className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <h2 className="font-medium text-amber-800">
          We couldn&apos;t load your data
        </h2>
        <p className="mt-2 text-sm text-amber-700">
          Something went wrong while reading your account. This is usually
          temporary — please try again.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
        >
          Try again
        </button>
      </section>
    </main>
  )
}
