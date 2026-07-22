import Link from 'next/link'
import { Show } from '@clerk/nextjs'
import { Header } from '@/components/header'
import {
  FolderOpen,
  MessageSquare,
  BarChart3,
  Users,
  Shield,
  Zap,
} from 'lucide-react'

const features = [
  {
    icon: FolderOpen,
    title: 'Report Library',
    description:
      'Store and organize all your medical reports in one secure place. AI analyzes and summarizes every upload.',
  },
  {
    icon: MessageSquare,
    title: 'AI Chat',
    description:
      'Chat with AI that understands your full medical history. Ask questions about your reports and get instant insights.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description:
      'Visualize your health data with interactive charts and graphs. Track trends across all your medical reports.',
  },
  {
    icon: Users,
    title: 'Family Sharing',
    description:
      'Invite family members to CareDesk. Share analytics and get notified about important health changes.',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />

      <main>
        {/* Hero */}
        <section className="px-4 py-12 text-center sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Your health,{' '}
              <span className="text-primary">understood</span>
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:mt-6 sm:text-xl">
              CareDesk is an AI-powered platform that turns your medical reports
              into actionable insights. Upload, chat, visualize, and share — all
              in one place.
            </p>
            <div className="mt-6 flex flex-col items-stretch gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-center">
              <Show when="signed-out">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/sign-up"
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                  >
                    Get started free
                  </Link>
                  <Link
                    href="/sign-in"
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    Sign in
                  </Link>
                </div>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                >
                  Go to Dashboard
                </Link>
              </Show>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold sm:text-3xl">
              Everything you need
            </h2>
            <p className="mt-3 text-center text-muted-foreground">
              Built for patients and caregivers who want control over their
              health data.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border bg-background p-6"
                >
                  <feature.icon className="size-8 text-primary" />
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Shield className="mx-auto size-10 text-primary" />
            <h2 className="mt-4 text-2xl font-semibold">Your data is private</h2>
            <p className="mt-3 text-muted-foreground">
              Every account is protected by row-level security. Your medical data
              is encrypted, isolated, and never shared without your explicit
              consent.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-muted/30 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Zap className="mx-auto size-8 text-primary" />
            <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">
              Ready to take control?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Join CareDesk and start understanding your health data today.
            </p>
            <div className="mt-6">
              <Show when="signed-out">
                <Link
                  href="/sign-up"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                >
                  Create your account
                </Link>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                >
                  Go to Dashboard
                </Link>
              </Show>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
            <span className="text-sm text-muted-foreground">
              CareDesk
            </span>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <Link href="/about" className="hover:underline">
                About Us
              </Link>
              <Link href="/privacy" className="hover:underline">
                Privacy Policy
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
