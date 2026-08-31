'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Show, UserButton } from '@/components/clerk-shim'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/language-context'
import {
  LayoutDashboard,
  FolderOpen,
  MessageSquare,
  BarChart3,
  Users,
  Settings,
  Sparkles,
} from 'lucide-react'

export function Sidebar() {
  const pathname = usePathname()
  const { t } = useLanguage()

  const navItems = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/dashboard/reports', label: t('nav.reports'), icon: FolderOpen },
    { href: '/dashboard/chat', label: t('nav.chat'), icon: MessageSquare },
    { href: '/dashboard/analytics', label: t('nav.analytics'), icon: BarChart3 },
    { href: '/dashboard/family', label: t('nav.family'), icon: Users },
    { href: '/dashboard/settings', label: t('nav.settings'), icon: Settings },
    { href: '/dashboard/upgrade', label: t('nav.upgrade'), icon: Sparkles },
  ]

  return (
    <aside className="hidden w-56 shrink-0 border-r border-outline-variant/40 bg-surface-container-low lg:block">
      <div className="flex h-full flex-col">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-outline-variant/30">
          <Link href="/" className="font-bold text-lg text-deep-navy tracking-tight">
            CareDesk
          </Link>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 space-y-1 p-3 mt-2">
          {navItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/10'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                )}
              >
                <item.icon className={cn('size-4 shrink-0', isActive && 'text-primary')} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Account */}
        <div className="border-t border-outline-variant/30 p-3">
          <Show when="signed-in">
            <div className="flex items-center gap-2.5 px-3 py-2">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'size-8',
                  },
                }}
              />
              <span className="text-xs text-on-surface-variant">{t('nav.account')}</span>
            </div>
          </Show>
        </div>
      </div>
    </aside>
  )
}
