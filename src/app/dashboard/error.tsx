'use client'

import { useEffect } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLanguage()

  useEffect(() => {
    console.error('[dashboard] render error:', error)
  }, [error])

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">{t('dashboard.error.title')}</h1>
      <section className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <h2 className="font-medium text-amber-800">
          {t('dashboard.error.heading')}
        </h2>
        <p className="mt-2 text-sm text-amber-700">
          {t('dashboard.error.desc')}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
        >
          {t('dashboard.error.tryAgain')}
        </button>
      </section>
    </main>
  )
}
