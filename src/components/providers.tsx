'use client'

import { LanguageProvider } from '@/lib/i18n/language-context'
import { ReactNode, useEffect } from 'react'

// Only import Clerk when a real key is available
const hasClerkKey = !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_') &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.length > 10;

/**
 * Safety net for Clerk's App Router navigation bug (clerk/javascript#9405).
 *
 * Clerk's post-auth (and post-sign-out) navigation wraps `router.push` in a
 * React transition whose promise only resolves when `isPending` settles. When
 * Next.js dedupes or cancels that push — which happens routinely right after
 * the OAuth redirect back from Google — the promise never resolves, so
 * `setActive` never completes and the UI sits on "loading…" forever even
 * though the session cookie is already set. A manual reload always fixes it.
 *
 * The watchdog watches Clerk's internal navigation buffers; if a navigation
 * promise stays pending beyond NAV_TIMEOUT_MS it finishes the navigation with
 * a full-page `location.replace`, which is equivalent to the manual reload
 * users had to do by hand. Normal navigations flush in well under a second,
 * so the watchdog only fires in the genuinely stuck case.
 */
const NAV_TIMEOUT_MS = 8000
const WATCHDOG_POLL_MS = 1000

interface ClerkNavState {
  promisesBuffer?: Array<(value: unknown) => void>
  pendingDestination?: string
}

function startClerkNavWatchdog() {
  if (typeof window === 'undefined') return () => {}

  const pendingAt = new Map<string, number>()

  const tick = () => {
    const navs = (window as unknown as {
      __clerk_internal_navigations?: Record<string, ClerkNavState | undefined>
    }).__clerk_internal_navigations
    if (!navs) return

    for (const nav of Object.values(navs)) {
      const buffered = nav?.promisesBuffer?.length ?? 0
      const dest = nav?.pendingDestination
      if (buffered === 0 || !dest) {
        if (dest === undefined) pendingAt.delete('__none__')
        continue
      }

      const key = `${dest}#${buffered}`
      const firstSeen = pendingAt.get(key)
      if (firstSeen === undefined) {
        pendingAt.set(key, Date.now())
        continue
      }

      if (Date.now() - firstSeen > NAV_TIMEOUT_MS) {
        pendingAt.clear()
        // Session cookie is already set (or cleared, for sign-out) at this
        // point — a full page load is exactly what un-stuck it manually.
        window.location.replace(dest)
        return
      }
    }
  }

  const timer = window.setInterval(tick, WATCHDOG_POLL_MS)
  return () => window.clearInterval(timer)
}

function ClerkWrapper({ children }: { children: ReactNode }) {
  useEffect(() => startClerkNavWatchdog(), [])

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ClerkProvider } = require('@clerk/nextjs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { shadcn } = require('@clerk/ui/themes');
  return <ClerkProvider appearance={{ theme: shadcn }}>{children}</ClerkProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      {hasClerkKey ? <ClerkWrapper>{children}</ClerkWrapper> : children}
    </LanguageProvider>
  );
}
