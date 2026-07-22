'use client'

import Link from 'next/link'
import { Show, UserButton } from '@clerk/nextjs'

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">CareDesk</span>
        </Link>

        <Show when="signed-out">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/sign-in"
              className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-muted sm:px-3"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 sm:px-3"
            >
              Get started
            </Link>
          </div>
        </Show>

        <Show when="signed-in">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-muted sm:px-3"
            >
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Home</span>
            </Link>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'size-8',
                },
              }}
            />
          </div>
        </Show>
      </div>
    </header>
  )
}
