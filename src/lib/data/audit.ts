import 'server-only'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export interface AuditEntry {
  actorId: string
  action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  recordId: string
  ip?: string | null
}

/**
 * Append an entry to the HIPAA audit_logs table (service-role only).
 *
 * Best-effort: a failed audit write must never break the user-facing
 * operation, so errors are logged and swallowed. Callers pass the client IP
 * from `req.headers.get('x-forwarded-for')` when available.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminSupabaseClient()
    const { error } = await admin.from('audit_logs').insert({
      actor_id: entry.actorId,
      action: entry.action,
      table_name: entry.table,
      record_id: entry.recordId,
      ip_address: entry.ip ?? null,
    })
    if (error) {
      logger.warn({ route: 'audit', err: error.message, entry }, 'Audit write failed')
    }
  } catch (err) {
    logger.warn({ route: 'audit', err: err instanceof Error ? err.message : String(err), entry }, 'Audit write failed')
  }
}

/** Extract the caller IP from proxy headers (first hop of x-forwarded-for). */
export function requestIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}
