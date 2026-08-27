import { Header } from '@/components/header'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">About CareDesk</h1>
          <div className="mt-8 space-y-6 text-lg text-muted-foreground">
            <p>
              CareDesk was founded on a simple principle: patients and their caregivers deserve
              full control and understanding of their medical data.
            </p>
            <p>
              Navigating healthcare is complicated enough without having to decipher complex medical
              jargon or dig through disorganized files. Our mission is to democratize health information
              using advanced AI, making it accessible, understandable, and actionable for everyone.
            </p>
            <h2 className="text-2xl font-semibold text-foreground pt-4">Our Vision</h2>
            <p>
              We envision a world where every individual feels empowered to make informed decisions
              about their health, supported by a system that explains rather than obscures.
            </p>
          </div>
        </div>
      </main>
      <footer className="border-t px-4 py-8 sm:px-6 lg:px-8 mt-20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-sm text-muted-foreground">CareDesk</span>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/about" className="hover:underline">About Us</Link>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
