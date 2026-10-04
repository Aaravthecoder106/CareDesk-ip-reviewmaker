import Link from 'next/link'
import { Logo } from '@/components/logo'

const hasClerkKey = !!(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_') &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.length > 15
)

export default function SignUpPage() {
  if (!hasClerkKey) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 bg-background">
        <div className="glass-panel organic-radius w-full max-w-sm text-center p-10">
          <Logo size="md" href={false} className="justify-center" />
          <p className="mt-6 text-[14px] text-on-surface-variant">Authentication is not configured. Please set up Clerk keys in your .env file.</p>
          <Link href="/" className="mt-4 inline-block text-[14px] text-secondary hover:underline">← Back to home</Link>
        </div>
      </main>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SignUp } = require('@clerk/nextjs')
  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo size="md" className="justify-center" />
          <p className="mt-2 text-[14px] text-on-surface-variant">Create your account</p>
        </div>
        {/*
          forceRedirectUrl: Clerk's default after-sign-up target is "/", which
          strands guests on the landing page where <GuestMigration /> never
          mounts — their uploaded report then never migrates. Force the
          dashboard so the migration trigger always runs.
        */}
        <SignUp forceRedirectUrl="/dashboard" />
      </div>
    </main>
  )
}
