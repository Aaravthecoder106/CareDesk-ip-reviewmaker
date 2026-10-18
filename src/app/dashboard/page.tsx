import { ensureCurrentUserProvisioned } from '@/lib/data/users'
import { DashboardContent } from './dashboard-content'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await ensureCurrentUserProvisioned()

  return <DashboardContent firstName={user?.first_name} />
}
