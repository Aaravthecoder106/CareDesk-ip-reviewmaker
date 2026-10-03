/**
 * Pure guest → authenticated migration logic.
 *
 * Deliberately free of `server-only`, Next.js, Supabase and path-alias
 * imports so the whole flow (validate → move file → insert rows → stamp
 * session) can be exercised by `node --test` with in-memory fakes.
 *
 * The HTTP route (`/api/public/migrate`) only does auth, parsing and
 * dependency wiring; every rule that decides *what* happens lives here.
 *
 * Data model note: the spec in migration_implimetation.md calls the guest
 * table `guest_sessions` with `session_id`/`hashed_token`. This codebase
 * stores the same data in `preview_tokens` keyed by a random bearer `token`
 * (0005_preview_tokens.sql) with `migrated_user_id`/`migrated_at`
 * (0007_guest_migration.sql). The column mapping is 1:1; only names differ.
 */

/** Migration window: 48h from guest upload (preview itself expires at 24h). */
export const MIGRATION_WINDOW_MS = 48 * 60 * 60 * 1000

/** Folder guest uploads live in, inside the `reports` storage bucket. */
export const GUEST_FOLDER = '__guest__'

/** Subset of the `preview_tokens` row the migration needs. */
export interface GuestSession {
  token: string
  file_path: string
  mime_type: string | null
  file_name: string
  summary: string | null
  lab_results: unknown
  medications: unknown
  conditions: unknown
  created_at: string
  migrated_user_id?: string | null
}

/** Row written to `reports` — mirrors its Insert type. */
export interface ReportInsert {
  patient_id: string
  title: string
  file_path: string
  mime_type: string | null
  ai_summary: string | null
  status: 'ready'
}

export interface LabInsert {
  report_id: string
  patient_id: string
  test_name: string
  value: number | null
  unit: string | null
  flag: string | null
  test_date: null
}

export interface ConditionInsert {
  patient_id: string
  name: string
  status: string | null
  diagnosed_at: null
}

export interface MedicationInsert {
  patient_id: string
  name: string
  dose: string | null
  frequency: string | null
  status: string
}

export type SessionCheck =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'analysis-not-ready'; message: string }

export type MigrationResult =
  | {
      status: 'migrated'
      reportId: string
      fileMovedOk: boolean
      counts: { labs: number; conditions: number; medications: number }
      warnings: string[]
    }
  | { status: 'already-migrated'; reportId: string | null }
  | { status: 'duplicate'; reportId: string }
  | { status: 'owned-elsewhere' }
  | { status: 'expired'; message: string }
  | { status: 'analysis-not-ready'; message: string }
  | { status: 'error'; message: string }

export interface MigrationStorage {
  /** Copy guest file to the authenticated path, then delete the guest copy. */
  moveFile(from: string, to: string, contentType: string): Promise<{ ok: boolean; error?: string }>
  /** Optional: used to recover when the guest copy is already gone. */
  exists?(path: string): Promise<boolean>
}

export interface MigrationDb {
  /**
   * Find an existing report for this user that is the same upload
   * (same title + same analysis). Returns its id, or null.
   */
  findDuplicateReport(patientId: string, title: string, summary: string | null): Promise<string | null>
  insertReport(row: ReportInsert): Promise<{ ok: boolean; id?: string; error?: string }>
  insertLabRows(rows: LabInsert[]): Promise<{ ok: boolean; error?: string }>
  insertConditionRows(rows: ConditionInsert[]): Promise<{ ok: boolean; error?: string }>
  insertMedicationRows(rows: MedicationInsert[]): Promise<{ ok: boolean; error?: string }>
  markMigrated(token: string, userId: string, migratedAtIso: string): Promise<{ ok: boolean; error?: string }>
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === 'object' && !Array.isArray(item),
  )
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asNumeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function firstText(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const text = asText(record[key])
    if (text) return text
  }
  return null
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

/** True when the AI produced *something* — i.e. analysis finished. */
export function analysisIsReady(session: GuestSession): boolean {
  if (asText(session.summary)) return true
  return (
    asRecordArray(session.lab_results).length > 0 ||
    asRecordArray(session.medications).length > 0 ||
    asRecordArray(session.conditions).length > 0
  )
}

/** Step A checks: expiry, analysis readiness. Callers check migration state first. */
export function checkSession(session: GuestSession, now: number = Date.now()): SessionCheck {
  const createdAt = Date.parse(session.created_at)
  if (Number.isFinite(createdAt) && now - createdAt > MIGRATION_WINDOW_MS) {
    return {
      ok: false,
      reason: 'expired',
      message: 'Your preview session expired. Upload a new report.',
    }
  }
  if (!analysisIsReady(session)) {
    return {
      ok: false,
      reason: 'analysis-not-ready',
      message: 'Analysis is still processing. Try again in a moment.',
    }
  }
  return { ok: true }
}

/** Authenticated storage path for a migrated file (Step B target). */
export function userStoragePath(userId: string, fileName: string): string {
  const safeName = fileName && fileName.trim() ? fileName.trim() : 'report'
  return `${userId}/${safeName}`
}

/* ------------------------------------------------------------------ *
 * Extraction (Steps D, E, F)
 * ------------------------------------------------------------------ */

export function mapLabRows(reportId: string, patientId: string, raw: unknown): LabInsert[] {
  return asRecordArray(raw).flatMap((entry) => {
    const testName = firstText(entry, ['test_name', 'name']) ?? 'Unknown Test'
    return [
      {
        report_id: reportId,
        patient_id: patientId,
        test_name: testName,
        value: asNumeric(entry.value),
        unit: asText(entry.unit),
        flag: asText(entry.flag),
        test_date: null,
      },
    ]
  })
}

export function mapConditionRows(patientId: string, raw: unknown): ConditionInsert[] {
  return asRecordArray(raw).flatMap((entry) => {
    const name = firstText(entry, ['name', 'test_name']) ?? 'Unknown Condition'
    return [
      {
        patient_id: patientId,
        name,
        status: asText(entry.status),
        diagnosed_at: null,
      },
    ]
  })
}

export function mapMedicationRows(patientId: string, raw: unknown): MedicationInsert[] {
  return asRecordArray(raw).flatMap((entry) => {
    const name = firstText(entry, ['name']) ?? 'Unknown Medication'
    return [
      {
        patient_id: patientId,
        name,
        dose: asText(entry.dose) ?? asText(entry.dosage),
        frequency: asText(entry.frequency),
        status: 'active',
      },
    ]
  })
}

/* ------------------------------------------------------------------ *
 * Orchestration (Steps A → G)
 * ------------------------------------------------------------------ */

export async function runMigration(
  session: GuestSession,
  userId: string,
  deps: { db: MigrationDb; storage: MigrationStorage },
  now: number = Date.now(),
): Promise<MigrationResult> {
  const warnings: string[] = []
  const { db, storage } = deps

  // ── A: already migrated? ────────────────────────────────────────────
  if (session.migrated_user_id) {
    if (session.migrated_user_id !== userId) return { status: 'owned-elsewhere' }
    const existingId = await findOwnReport(db, userId, session)
    return { status: 'already-migrated', reportId: existingId }
  }

  // ── A: expiry + analysis readiness ──────────────────────────────────
  const check = checkSession(session, now)
  if (!check.ok) {
    return check.reason === 'expired'
      ? { status: 'expired', message: check.message }
      : { status: 'analysis-not-ready', message: check.message }
  }

  const title = session.file_name?.trim() || 'Uploaded Report'

  // ── Duplicate guard: same user, same upload already in the library ──
  const duplicateId = await db.findDuplicateReport(userId, title, session.summary ?? null)
  if (duplicateId) {
    const stamp = await db.markMigrated(session.token, userId, new Date(now).toISOString())
    if (!stamp.ok) warnings.push(`markMigrated: ${stamp.error}`)
    return { status: 'duplicate', reportId: duplicateId }
  }

  // ── B: move the storage file guest → authenticated path ────────────
  const targetPath = userStoragePath(userId, title)
  let finalPath = session.file_path || ''
  let fileMovedOk = false

  if (session.file_path) {
    const move = await storage.moveFile(
      session.file_path,
      targetPath,
      session.mime_type || 'application/pdf',
    )
    if (move.ok) {
      fileMovedOk = true
      finalPath = targetPath
    } else {
      // Spec: storage failure must NOT block the report record.
      warnings.push(`storage move: ${move.error || 'failed'}`)
      const targetExists = storage.exists ? await storage.exists(targetPath) : false
      if (targetExists) finalPath = targetPath // an earlier attempt moved it
    }
  } else if (storage.exists && (await storage.exists(targetPath))) {
    finalPath = targetPath
  }

  // ── C: permanent report record ──────────────────────────────────────
  const reportRow: ReportInsert = {
    patient_id: userId,
    title,
    file_path: finalPath,
    mime_type: session.mime_type || 'application/pdf',
    ai_summary: session.summary ?? null,
    status: 'ready',
  }
  const inserted = await db.insertReport(reportRow)
  if (!inserted.ok || !inserted.id) {
    return {
      status: 'error',
      message: 'Failed to create report. Please try uploading from the dashboard.',
    }
  }
  const reportId = inserted.id

  // ── D: lab results ──────────────────────────────────────────────────
  const labRows = mapLabRows(reportId, userId, session.lab_results)
  if (labRows.length > 0) {
    const res = await db.insertLabRows(labRows)
    if (!res.ok) warnings.push(`lab_results: ${res.error}`)
  }

  // ── E: conditions ───────────────────────────────────────────────────
  const conditionRows = mapConditionRows(userId, session.conditions)
  if (conditionRows.length > 0) {
    const res = await db.insertConditionRows(conditionRows)
    if (!res.ok) warnings.push(`conditions: ${res.error}`)
  }

  // ── F: medications ──────────────────────────────────────────────────
  const medicationRows = mapMedicationRows(userId, session.medications)
  if (medicationRows.length > 0) {
    const res = await db.insertMedicationRows(medicationRows)
    if (!res.ok) warnings.push(`medications: ${res.error}`)
  }

  // ── G: stamp the session (last, so a failure above can be retried) ──
  const stamp = await db.markMigrated(session.token, userId, new Date(now).toISOString())
  if (!stamp.ok) warnings.push(`markMigrated: ${stamp.error}`)

  return {
    status: 'migrated',
    reportId,
    fileMovedOk,
    counts: { labs: labRows.length, conditions: conditionRows.length, medications: medicationRows.length },
    warnings,
  }
}

/** Locate the report a previous (same-user) migration created. */
async function findOwnReport(
  db: MigrationDb,
  userId: string,
  session: GuestSession,
): Promise<string | null> {
  const summary = session.summary ?? null
  return db.findDuplicateReport(userId, session.file_name?.trim() || 'Uploaded Report', summary)
}
