'use client'

import Link from 'next/link'
import { Show } from '@clerk/nextjs'
import { Header } from '@/components/header'
import { useLanguage } from '@/lib/i18n/language-context'
import {
  FolderOpen,
  MessageSquare,
  BarChart3,
  Users,
  Shield,
  Zap,
} from 'lucide-react'

export default function Home() {
  const { t } = useLanguage()

  const features = [
    {
      icon: FolderOpen,
      title: t('home.features.reportLibrary.title'),
      description: t('home.features.reportLibrary.desc'),
    },
    {
      icon: MessageSquare,
      title: t('home.features.aiChat.title'),
      description: t('home.features.aiChat.desc'),
    },
    {
      icon: BarChart3,
      title: t('home.features.analytics.title'),
      description: t('home.features.analytics.desc'),
    },
    {
      icon: Users,
      title: t('home.features.familySharing.title'),
      description: t('home.features.familySharing.desc'),
    },
  ]

  return (
    <div className="min-h-screen">
      <Header />

      <main>
        {/* Hero */}
        <section className="px-4 py-12 text-center sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {t('home.hero.title1')}{' '}
              <span className="text-primary">{t('home.hero.title2')}</span>
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:mt-6 sm:text-xl">
              {t('home.hero.subtitle')}
            </p>
            <div className="mt-6 flex flex-col items-stretch gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-center">
              <Show when="signed-out">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/sign-up"
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                  >
                    {t('home.hero.getStarted')}
                  </Link>
                  <Link
                    href="/sign-in"
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    {t('home.hero.signIn')}
                  </Link>
                </div>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                >
                  {t('home.hero.goToDashboard')}
                </Link>
              </Show>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold sm:text-3xl">
              {t('home.features.title')}
            </h2>
            <p className="mt-3 text-center text-muted-foreground">
              {t('home.features.subtitle')}
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
            <h2 className="mt-4 text-2xl font-semibold">{t('home.trust.title')}</h2>
            <p className="mt-3 text-muted-foreground">
              {t('home.trust.desc')}
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-muted/30 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Zap className="mx-auto size-8 text-primary" />
            <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">
              {t('home.cta.title')}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t('home.cta.desc')}
            </p>
            <div className="mt-6">
              <Show when="signed-out">
                <Link
                  href="/sign-up"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                >
                  {t('home.cta.createAccount')}
                </Link>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                >
                  {t('home.cta.goToDashboard')}
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
                {t('home.footer.about')}
              </Link>
              <Link href="/privacy" className="hover:underline">
                {t('home.footer.privacy')}
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
