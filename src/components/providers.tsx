'use client'

import { LanguageProvider } from '@/lib/i18n/language-context'
import { ReactNode } from 'react'

// Only import Clerk when a real key is available
const hasClerkKey = !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_') &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.length > 10;

function ClerkWrapper({ children }: { children: ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ClerkProvider } = require('@clerk/nextjs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { shadcn } = require('@clerk/ui/themes');
  return <ClerkProvider appearance={{ theme: shadcn }}>{children}</ClerkProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      {hasClerkKey ? <ClerkWrapper>{children}</ClerkWrapper> : children}
    </LanguageProvider>
  );
}
