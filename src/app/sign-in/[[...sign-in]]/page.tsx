import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-lg font-semibold">
            CareDesk
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your account
          </p>
        </div>
        <SignIn />
      </div>
    </main>
  )
}
