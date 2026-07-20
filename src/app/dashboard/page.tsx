import { ensureCurrentUserProvisioned, getCurrentPatient } from '@/lib/data/users'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FolderOpen,
  MessageSquare,
  BarChart3,
  Users,
} from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const quickActions = [
  {
    icon: FolderOpen,
    title: 'Report Library',
    description: 'Upload and manage your medical reports',
    href: '/dashboard/reports',
  },
  {
    icon: MessageSquare,
    title: 'AI Chat',
    description: 'Ask questions about your health data',
    href: '/dashboard/chat',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description: 'View interactive health visualizations',
    href: '/dashboard/analytics',
  },
  {
    icon: Users,
    title: 'Family',
    description: 'Share insights with family members',
    href: '/dashboard/family',
  },
]

export default async function DashboardPage() {
  const user = await ensureCurrentUserProvisioned()
  const patient = await getCurrentPatient()

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">
          Welcome{user?.first_name ? `, ${user.first_name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s an overview of your health dashboard.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <action.icon className="size-8 text-primary" />
                <CardTitle className="text-sm">{action.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {action.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {!patient && (
        <Card className="mt-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="pt-6">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Your patient profile is still being set up. This usually takes a
              few seconds.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
