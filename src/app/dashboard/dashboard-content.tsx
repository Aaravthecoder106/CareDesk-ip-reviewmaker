'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/lib/i18n/language-context'
import {
  FolderOpen,
  MessageSquare,
  BarChart3,
  Users,
} from 'lucide-react'
import Link from 'next/link'

interface DashboardContentProps {
  firstName?: string | null
  hasPatient: boolean
}

export function DashboardContent({ firstName, hasPatient }: DashboardContentProps) {
  const { t } = useLanguage()

  const quickActions = [
    {
      icon: FolderOpen,
      title: t('dashboard.reportLibrary'),
      description: t('dashboard.reportLibraryDesc'),
      href: '/dashboard/reports',
    },
    {
      icon: MessageSquare,
      title: t('dashboard.aiChat'),
      description: t('dashboard.aiChatDesc'),
      href: '/dashboard/chat',
    },
    {
      icon: BarChart3,
      title: t('dashboard.analytics'),
      description: t('dashboard.analyticsDesc'),
      href: '/dashboard/analytics',
    },
    {
      icon: Users,
      title: t('dashboard.family'),
      description: t('dashboard.familyDesc'),
      href: '/dashboard/family',
    },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold sm:text-2xl">
          {t('dashboard.welcome')}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dashboard.overview')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <action.icon className="size-8 text-primary" />
                <CardTitle className="text-sm">{action.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {action.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {!hasPatient && (
        <Card className="mt-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="pt-6">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t('dashboard.profileSetup')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
