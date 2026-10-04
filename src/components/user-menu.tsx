'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2, Settings, Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const hasClerk = !!(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_') &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.length > 10
)

/**
 * Account menu with a sign-out that cannot hang.
 *
 * Why not <UserButton />? Clerk's UserButton performs its post-sign-out
 * navigation through the same transition-wrapped router.push that gets stuck
 * after OAuth (clerk/javascript#9405) — users saw the spinner forever and had
 * to reload. This menu calls `clerk.signOut()` and then does a full-page
 * `window.location.assign`, which always lands on a clean signed-out app.
 */
export function UserMenu() {
  // Module-level constant — never flips between renders, so conditional
  // rendering here is rules-of-hooks-safe (hooks live in ClerkUserMenu).
  if (!hasClerk) return <GuestAvatar />
  return <ClerkUserMenu />
}

function GuestAvatar() {
  return (
    <div
      className="inline-flex size-8 items-center justify-center rounded-full bg-surface-container text-xs font-medium text-on-surface-variant"
      aria-hidden
    >
      ?
    </div>
  )
}

function ClerkUserMenu() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useClerk, useUser } = require('@clerk/nextjs') as {
    useClerk: () => { signOut: (opts?: Record<string, unknown>) => Promise<unknown> }
    useUser: () => {
      isLoaded: boolean
      isSignedIn: boolean
      user: {
        fullName: string | null
        firstName: string | null
        primaryEmailAddress: { emailAddress: string } | null
        imageUrl: string
      } | null
    }
  }

  const clerk = useClerk()
  const router = useRouter()
  const { isLoaded, isSignedIn, user } = useUser()
  const [signingOut, setSigningOut] = useState(false)
  const startedRef = useRef(false)

  async function doSignOut() {
    if (startedRef.current) return
    startedRef.current = true
    setSigningOut(true)
    try {
      // Clears the session server-side. We deliberately do NOT rely on
      // Clerk's post-sign-out navigation (that's the part that hangs).
      await clerk.signOut()
    } catch {
      // Session may already be gone — proceed with the reload either way.
    }
    // Full page load guarantees every provider sees the cleared session.
    window.location.assign('/')
  }

  // Hard deadline: never leave the user on the spinner, even if
  // clerk.signOut() never resolves (network loss, SDK error, ...).
  useEffect(() => {
    if (!signingOut) return
    const t = setTimeout(() => window.location.assign('/'), 4000)
    return () => clearTimeout(t)
  }, [signingOut])

  if (!isLoaded) {
    return <div className="size-8 animate-pulse rounded-full bg-surface-container" aria-hidden />
  }
  if (!isSignedIn || !user) return null

  const name = user.fullName || user.firstName || 'Account'
  const email = user.primaryEmailAddress?.emailAddress ?? ''
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
        aria-label="Account menu"
      >
        <Avatar className="size-8 border border-outline-variant/40">
          <AvatarImage src={user.imageUrl} alt={name} />
          <AvatarFallback className="bg-secondary/15 text-[11px] font-semibold text-deep-navy">
            {initials || '?'}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="px-2 py-1.5">
          <p className="truncate text-sm font-semibold text-deep-navy">{name}</p>
          {email && <p className="truncate text-xs font-normal text-on-surface-variant">{email}</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 px-2 py-2 text-sm"
          onClick={() => router.push('/dashboard/settings')}
        >
          <Settings className="size-4 text-on-surface-variant" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 px-2 py-2 text-sm"
          onClick={() => router.push('/dashboard/upgrade')}
        >
          <Sparkles className="size-4 text-on-surface-variant" />
          Upgrade
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          className="gap-2 px-2 py-2 text-sm"
          onClick={() => {
            void doSignOut()
          }}
        >
          {signingOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
