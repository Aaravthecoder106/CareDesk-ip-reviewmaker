import { ensureCurrentUserProvisioned, getCurrentPatient } from '@/lib/data/users'

export const dynamic = 'force-dynamic'

/**
 * Minimal authenticated round-trip verification surface (Phase 1).
 *
 * Proves: Sign Up -> User Sync -> Database Row -> Read Own Data.
 *   1. Middleware guarantees the caller is authenticated by Clerk.
 *   2. ensureCurrentUserProvisioned() reads the caller's public.users row via
 *      RLS, self-healing it from the live Clerk profile if the webhook has not
 *      yet landed.
 *   3. getCurrentPatient() reads the auto-provisioned patients row via RLS.
 * Both reads are RLS-scoped, so this page can only ever display the caller's
 * own data.
 *
 * This is a scaffold to validate the identity pipeline end to end; the real
 * dashboard UI is ported in a later phase.
 */
export default async function DashboardPage() {
  const user = await ensureCurrentUserProvisioned()
  const patient = await getCurrentPatient()

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-gray-500">
        Identity round-trip check — this data is read through Row Level Security
        and is scoped to your account only.
      </p>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="font-medium">public.users</h2>
        {user ? (
          <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-1 text-sm">
            <dt className="text-gray-500">id</dt>
            <dd className="font-mono">{user.id}</dd>
            <dt className="text-gray-500">email</dt>
            <dd>{user.email}</dd>
            <dt className="text-gray-500">name</dt>
            <dd>
              {[user.first_name, user.last_name].filter(Boolean).join(' ') || '—'}
            </dd>
            <dt className="text-gray-500">role</dt>
            <dd>{user.role}</dd>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-amber-600">
            No user row yet — provisioning may still be in progress.
          </p>
        )}
      </section>

      <section className="mt-4 rounded-lg border p-4">
        <h2 className="font-medium">public.patients</h2>
        {patient ? (
          <p className="mt-2 text-sm text-green-600">
            Patient profile provisioned (id <span className="font-mono">{patient.id}</span>).
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-600">No patient profile found.</p>
        )}
      </section>
    </main>
  )
}
