'use client'

import Link from 'next/link'
import { Show, UserButton } from '@/components/clerk-shim'
import { useLanguage } from '@/lib/i18n/language-context'
import { Globe } from 'lucide-react'

export function Header() {
  const { locale, setLocale, t } = useLanguage()

  return (
    <header className="sticky top-0 z-50 glass-panel-strong border-b border-white/50">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-16">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-deep-navy tracking-tight">
          CareDesk
        </Link>

        <Show when="signed-out">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setLocale(locale === 'en' ? 'hi' : 'en')}
              className="inline-flex h-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors hover:bg-surface-container"
              title={locale === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}
            >
              <Globe className="size-4" />
              <span className="ml-1 hidden sm:inline">{locale === 'en' ? 'हिंदी' : 'English'}</span>
            </button>
            <Link
              href="/sign-in"
              className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-surface-container sm:px-3"
            >
              {t('nav.signIn')}
            </Link>
            <Link
              href="/sign-up"
              className="btn-primary-gradient inline-flex h-8 items-center justify-center rounded-full px-4 text-sm font-bold sm:px-5"
            >
              {t('nav.getStarted')}
            </Link>
          </div>
        </Show>

        <Show when="signed-in">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setLocale(locale === 'en' ? 'hi' : 'en')}
              className="inline-flex h-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors hover:bg-surface-container"
              title={locale === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}
            >
              <Globe className="size-4" />
              <span className="ml-1 hidden sm:inline">{locale === 'en' ? 'हिंदी' : 'English'}</span>
            </button>
            <Link
              href="/dashboard"
              className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-surface-container sm:px-3"
            >
              <span className="hidden sm:inline">{t('nav.dashboard')}</span>
              <span className="sm:hidden">{t('nav.home')}</span>
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
