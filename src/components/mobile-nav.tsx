'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Show, UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FolderOpen,
  MessageSquare,
  BarChart3,
  Users,
  Settings,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/reports', label: 'Report Library', icon: FolderOpen },
  { href: '/dashboard/chat', label: 'AI Chat', icon: MessageSquare },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/family', label: 'Family', icon: Users },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <Link href="/dashboard" className="font-semibold">
          CareDesk
        </Link>
        <div className="flex items-center gap-2">
          <Show when="signed-in">
            <UserButton
              appearance={{ elements: { avatarBox: 'size-7' } }}
            />
          </Show>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav className="border-b bg-background p-3 space-y-1">
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
