'use client'

import { ReactNode } from 'react'

// Check if we have a real Clerk publishable key
const hasRealClerk = !!(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_') &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.length > 15
)

// Lazy-loaded real Clerk components
let RealShow: React.ComponentType<{ when: string; children: ReactNode }> | null = null
let RealUserButton: React.ComponentType<any> | null = null

if (hasRealClerk) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@clerk/nextjs')
    RealShow = mod.Show
    RealUserButton = mod.UserButton
  } catch {}
}

// No-op Show: in dev mode without Clerk, signed-out state shows children, signed-in hides
export function Show({ when, children }: { when: string; children: ReactNode }) {
  if (RealShow) {
    return <RealShow when={when}>{children}</RealShow>
  }
  // Without Clerk, show "signed-out" content (public UI), hide "signed-in" content
  if (when === 'signed-out') return <>{children}</>
  return null
}

// No-op UserButton: renders a placeholder avatar
export function UserButton(props: any) {
  if (RealUserButton) {
    return <RealUserButton {...props} />
  }
  return (
    <div className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
      ?
    </div>
  )
}

// No-op useUser: returns null user in dev mode
export function useUser() {
  if (hasRealClerk) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useUser: realUseUser } = require('@clerk/nextjs')
    return realUseUser()
  }
  return { user: null, isLoaded: true, isSignedIn: false }
}
