import { Header } from '@/components/header'
import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <div className="mt-8 space-y-6 text-lg text-muted-foreground">
            <p><strong>Last Updated:</strong> July 2026</p>
            <p>
              At CareDesk, your privacy and data security are our highest priorities. Because we handle
              sensitive health information, we adhere strictly to robust data protection principles.
            </p>
            
            <h2 className="text-2xl font-semibold text-foreground pt-4">Data Isolation</h2>
            <p>
              Every user account is protected by strict Row-Level Security (RLS) policies at the database level.
              This means your data is mathematically isolated; no other user can access your reports or analytics unless
              you explicitly grant them permission through our Family Sharing feature.
            </p>

            <h2 className="text-2xl font-semibold text-foreground pt-4">AI Processing</h2>
            <p>
              We use advanced AI to analyze your reports. The data sent to the AI models is strictly used for
              generating your summaries and analytics. It is not used to train global models or shared with unauthorized
              third parties.
            </p>
            
            <h2 className="text-2xl font-semibold text-foreground pt-4">Family Sharing</h2>
            <p>
              If you choose to use the Family Sharing feature, you are explicitly opting in to share your
              aggregated analytics and health alerts with trusted individuals. You can revoke this access at any time.
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
