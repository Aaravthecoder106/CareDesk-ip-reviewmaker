'use client'

import { useEffect } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLanguage()

  useEffect(() => {
    // Log to console in dev; in production this would go to Sentry
    console.error('[dashboard] render error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold">{t('dashboard.error.heading')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('dashboard.error.desc')}
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-muted-foreground/70">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <Button onClick={reset} variant="outline" className="mt-2">
            <RefreshCw className="mr-2 size-4" />
            {t('dashboard.error.tryAgain')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
