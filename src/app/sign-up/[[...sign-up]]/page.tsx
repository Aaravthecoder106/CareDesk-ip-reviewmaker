import Link from 'next/link'

const hasClerkKey = !!(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_') &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.length > 15
)

export default function SignUpPage() {
  if (!hasClerkKey) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <Link href="/" className="text-lg font-semibold">CareDesk</Link>
          <p className="mt-6 text-muted-foreground">Authentication is not configured. Please set up Clerk keys in your .env file.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-primary hover:underline">← Back to home</Link>
        </div>
      </main>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SignUp } = require('@clerk/nextjs')
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-lg font-semibold">CareDesk</Link>
          <p className="mt-2 text-sm text-muted-foreground">Create your account</p>
        </div>
        <SignUp />
      </div>
    </main>
  )
}
