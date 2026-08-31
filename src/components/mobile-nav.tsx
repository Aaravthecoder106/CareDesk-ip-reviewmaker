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
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

export function MobileNav() {
  const pathname = usePathname()
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)

  const navItems = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/dashboard/reports', label: t('nav.reports'), icon: FolderOpen },
    { href: '/dashboard/chat', label: t('nav.chat'), icon: MessageSquare },
    { href: '/dashboard/analytics', label: t('nav.analytics'), icon: BarChart3 },
    { href: '/dashboard/family', label: t('nav.family'), icon: Users },
  ]

  return (
    <>
      {/* Top bar for mobile */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/40 glass-panel-strong lg:hidden">
        <Link href="/" className="font-bold text-lg text-deep-navy tracking-tight">
          CareDesk
        </Link>
        <div className="flex items-center gap-2">
          <Show when="signed-in">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'size-8',
                },
              }}
            />
          </Show>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-surface-container transition-colors"
          >
            {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="lg:hidden glass-panel-strong border-b border-outline-variant/40 px-4 py-3">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
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
        </div>
      )}
    </>
  )
}
