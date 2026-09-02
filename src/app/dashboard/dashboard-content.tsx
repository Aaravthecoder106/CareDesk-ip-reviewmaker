'use client'

import { useLanguage } from '@/lib/i18n/language-context'
import {
  FolderOpen,
  MessageSquare,
  BarChart3,
  Users,
  Sparkles,
  Shield,
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
      color: 'text-secondary',
      bg: 'bg-secondary/10',
    },
    {
      icon: MessageSquare,
      title: t('dashboard.aiChat'),
      description: t('dashboard.aiChatDesc'),
      href: '/dashboard/chat',
      color: 'text-electric-blue',
      bg: 'bg-electric-blue/10',
    },
    {
      icon: BarChart3,
      title: t('dashboard.analytics'),
      description: t('dashboard.analyticsDesc'),
      href: '/dashboard/analytics',
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      icon: Users,
      title: t('dashboard.family'),
      description: t('dashboard.familyDesc'),
      href: '/dashboard/family',
      color: 'text-secondary',
      bg: 'bg-secondary/10',
    },
  ]

  return (
    <div className="p-5 md:p-8">
      <div className="mb-8">
        <h1 className="text-[24px] leading-[32px] font-semibold text-on-surface">
          {t('dashboard.welcome')}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 text-[14px] text-on-surface-variant">
          {t('dashboard.overview')}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href}>
            <div className="glass-panel organic-radius p-6 transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full">
              <div className={`w-12 h-12 rounded-2xl ${action.bg} flex items-center justify-center mb-4`}>
                <action.icon className={`size-6 ${action.color}`} />
              </div>
              <h3 className="text-[16px] font-semibold text-deep-navy mb-2">{action.title}</h3>
              <p className="text-[14px] text-on-surface-variant leading-[22px]">
                {action.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Profile Setup Notice */}
      {!hasPatient && (
        <div className="mt-6 glass-panel organic-radius p-5 border border-electric-blue/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-electric-blue/10 flex items-center justify-center shrink-0">
              <Sparkles className="size-5 text-electric-blue" />
            </div>
            <p className="text-[14px] text-on-surface">
              {t('dashboard.profileSetup')}
            </p>
          </div>
        </div>
      )}

      {/* Security Badge */}
      <div className="mt-8 glass-panel rounded-xl p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Shield className="size-6 text-primary" />
        </div>
        <div>
          <h3 className="text-[16px] font-semibold text-deep-navy">Your Data is Secure</h3>
          <p className="text-[14px] text-on-surface-variant">End-to-end encryption protects all your medical records and health insights.</p>
        </div>
      </div>
    </div>
  )
}
