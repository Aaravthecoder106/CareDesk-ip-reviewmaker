'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Show, UserButton } from '@clerk/nextjs'
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
    <aside className="hidden w-56 shrink-0 border-r bg-sidebar lg:block">
      <div className="flex h-full flex-col">
        <nav className="flex-1 space-y-1 p-3">
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
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-3">
          <Show when="signed-in">
            <div className="flex items-center gap-2.5 px-3 py-2">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'size-8',
                  },
                }}
              />
              <span className="text-xs text-muted-foreground">{t('nav.account')}</span>
            </div>
          </Show>
        </div>
      </div>
    </aside>
  )
}
