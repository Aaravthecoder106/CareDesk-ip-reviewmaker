'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import translations, { type Locale } from './translations'

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    const saved = localStorage.getItem('caredesk-lang') as Locale | null
    if (saved === 'hi' || saved === 'en') setLocaleState(saved)
  }, [])

  function setLocale(l: Locale) {
    setLocaleState(l)
    localStorage.setItem('caredesk-lang', l)
    document.documentElement.lang = l
  }

  function t(key: string, params?: Record<string, string | number>): string {
    const dict = translations[locale] as Record<string, string>
    let value = dict[key] ?? translations.en[key as keyof typeof translations.en] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return value
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
