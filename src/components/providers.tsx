'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { shadcn } from '@clerk/ui/themes'
import { LanguageProvider } from '@/lib/i18n/language-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={{ theme: shadcn }}>
      <LanguageProvider>
        {children}
      </LanguageProvider>
    </ClerkProvider>
  )
}
