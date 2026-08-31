import { Sidebar } from '@/components/sidebar'
import { MobileNav } from '@/components/mobile-nav'
import { FeedbackWidget } from '@/components/feedback-widget'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileNav />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-container-low/30">
          {children}
        </main>
      </div>
      <FeedbackWidget />
    </div>
  )
}
