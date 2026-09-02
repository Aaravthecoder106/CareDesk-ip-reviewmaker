import { ensureCurrentUserProvisioned, getCurrentPatient } from '@/lib/data/users'
import { DashboardContent } from './dashboard-content'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await ensureCurrentUserProvisioned()
  const patient = await getCurrentPatient()

  return (
    <DashboardContent
      firstName={user?.first_name}
      hasPatient={!!patient}
    />
  )
}
