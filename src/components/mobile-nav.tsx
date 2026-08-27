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
  Menu,
  X,
  Globe,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { locale, setLocale, t } = useLanguage()

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
    <div className="shrink-0 lg:hidden">
      <div className="flex items-center justify-between border-b bg-background px-4 py-2.5">
        <Link href="/dashboard" className="font-semibold">
          CareDesk
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLocale(locale === 'en' ? 'hi' : 'en')}
            className="inline-flex h-7 items-center justify-center rounded-lg px-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Globe className="size-4" />
          </button>
          <Show when="signed-in">
            <UserButton
              appearance={{ elements: { avatarBox: 'size-7' } }}
            />
          </Show>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav className="max-h-[60vh] overflow-y-auto border-b bg-background p-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
