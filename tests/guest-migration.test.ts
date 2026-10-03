import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MIGRATION_WINDOW_MS,
  analysisIsReady,
  checkSession,
  mapConditionRows,
  mapLabRows,
  mapMedicationRows,
  runMigration,
  userStoragePath,
} from '../src/lib/guest-migration.ts'
import type {
  ConditionInsert,
  GuestSession,
  LabInsert,
  MedicationInsert,
  MigrationDb,
  MigrationResult,
  MigrationStorage,
  ReportInsert,
} from '../src/lib/guest-migration.ts'

/* ------------------------------------------------------------------ *
 * Fixtures + in-memory fakes
 * ------------------------------------------------------------------ */

function makeSession(overrides: Partial<GuestSession> = {}): GuestSession {
  return {
    token: 'tok_123',
    file_path: '__guest__/tok_123.pdf',
    mime_type: 'application/pdf',
    file_name: 'blood-report.pdf',
    summary: 'Fasting glucose is elevated at 145 mg/dL.',
    lab_results: [{ test_name: 'Fasting Glucose', value: 145, unit: 'mg/dL', flag: 'high' }],
    medications: [{ name: 'Metformin', dose: '500mg', frequency: 'twice daily' }],
    conditions: [{ name: 'Type 2 Diabetes', status: 'active' }],
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h old
    migrated_user_id: null,
    ...overrides,
  }
}

interface Store {
  reports: (ReportInsert & { id: string })[]
  labs: LabInsert[]
  conditions: ConditionInsert[]
  medications: MedicationInsert[]
  stamps: { token: string; userId: string; at: string }[]
}

interface Fakes {
  db: MigrationDb
  storage: MigrationStorage
  store: Store
  storageCalls: { from: string; to: string; contentType: string }[]
}

interface FakesOptions {
  reportInsertFails?: boolean
  labInsertFails?: boolean
  stampFails?: boolean
  storageFails?: boolean
  targetExists?: boolean
}

function makeFakes(options: FakesOptions = {}): Fakes {
  const store: Store = { reports: [], labs: [], conditions: [], medications: [], stamps: [] }
  const storageCalls: Fakes['storageCalls'] = []
  let nextId = 1

  const db: MigrationDb = {
    async findDuplicateReport(patientId, title, summary) {
      const hit = store.reports.find(
        (row) =>
          row.patient_id === patientId &&
          row.title === title &&
          (summary ? row.ai_summary === summary : true),
      )
      return hit ? hit.id : null
    },
    async insertReport(row) {
      if (options.reportInsertFails) return { ok: false, error: '23503 foreign key violation' }
      const id = `rep-${nextId++}`
      store.reports.push({ ...row, id })
      return { ok: true, id }
    },
    async insertLabRows(rows) {
      if (options.labInsertFails) return { ok: false, error: 'null value in column' }
      store.labs.push(...rows)
      return { ok: true }
    },
    async insertConditionRows(rows) {
      store.conditions.push(...rows)
      return { ok: true }
    },
    async insertMedicationRows(rows) {
      store.medications.push(...rows)
      return { ok: true }
    },
    async markMigrated(token, userId, at) {
      if (options.stampFails) return { ok: false, error: 'connection reset' }
      store.stamps.push({ token, userId, at })
      return { ok: true }
    },
  }

  const storage: MigrationStorage = {
    async moveFile(from, to, contentType) {
      if (options.storageFails) return { ok: false, error: 'guest file not found' }
      storageCalls.push({ from, to, contentType })
      return { ok: true }
    },
    async exists() {
      return !!options.targetExists
    },
  }

  return { db, storage, store, storageCalls }
}

const USER = 'user_clerk_1'

/* ------------------------------------------------------------------ *
 * 1. Session validation (spec Step A)
 * ------------------------------------------------------------------ */

test('fresh session passes validation', () => {
  const check = checkSession(makeSession())
  assert.equal(check.ok, true)
})

test('session older than the 48h migration window is expired', () => {
  const old = makeSession({
    created_at: new Date(Date.now() - MIGRATION_WINDOW_MS - 60_000).toISOString(),
  })
  const check = checkSession(old)
  assert.equal(check.ok, false)
  assert.equal(check.ok === false && check.reason, 'expired')
})

test('session with no analysis payload is not ready (kept alive for retry)', () => {
  const empty = makeSession({ summary: '   ', lab_results: [], medications: [], conditions: [] })
  const check = checkSession(empty)
  assert.equal(check.ok, false)
  assert.equal(check.ok === false && check.reason, 'analysis-not-ready')
})

test('analysisIsReady accepts array-only payloads with no summary', () => {
  assert.equal(analysisIsReady(makeSession({ summary: null })), true)
  assert.equal(
    analysisIsReady(makeSession({ summary: null, lab_results: [], medications: [], conditions: [] })),
    false,
  )
})

/* ------------------------------------------------------------------ *
 * 2. Path helper (spec Step B)
 * ------------------------------------------------------------------ */

test('userStoragePath puts the file under the Clerk user id', () => {
  assert.equal(userStoragePath('user_abc', 'report.pdf'), 'user_abc/report.pdf')
  assert.equal(userStoragePath('user_abc', ''), 'user_abc/report')
})

/* ------------------------------------------------------------------ *
 * 3. Extraction logic (spec Steps D, E, F)
 * ------------------------------------------------------------------ */

test('mapLabRows keeps numbers, parses numeric strings, nulls junk', () => {
  const rows = mapLabRows('rep-1', USER, [
    { test_name: 'Fasting Glucose', value: 145, unit: 'mg/dL', flag: 'high' },
    { test_name: 'HbA1c', value: '6.8', unit: '%', flag: 'high' },
    { name: 'Cholesterol', value: 'not-a-number', unit: null, flag: null },
    { value: 12 }, // no name → placeholder
    'not-an-object', // ignored
  ])

  assert.equal(rows.length, 4)
  assert.deepEqual(
    rows.map((r) => [r.test_name, r.value, r.unit, r.flag]),
    [
      ['Fasting Glucose', 145, 'mg/dL', 'high'],
      ['HbA1c', 6.8, '%', 'high'],
      ['Cholesterol', null, null, null],
      ['Unknown Test', 12, null, null],
    ],
  )
  assert.equal(rows[0].report_id, 'rep-1')
  assert.equal(rows[0].patient_id, USER)
  assert.equal(rows[0].test_date, null)
})

test('mapConditionRows maps name/status and tolerates junk', () => {
  const rows = mapConditionRows(USER, [
    { name: 'Type 2 Diabetes', status: 'chronic' },
    { name: 'Hypertension' },
    42,
  ])
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    patient_id: USER,
    name: 'Type 2 Diabetes',
    status: 'chronic',
    diagnosed_at: null,
  })
  assert.equal(rows[1].status, null)
})

test('mapMedicationRows maps dose (with dosage fallback) and defaults status', () => {
  const rows = mapMedicationRows(USER, [
    { name: 'Metformin', dose: '500mg', frequency: 'twice daily' },
    { name: 'Atorvastatin', dosage: '20mg' },
  ])
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    patient_id: USER,
    name: 'Metformin',
    dose: '500mg',
    frequency: 'twice daily',
    status: 'active',
  })
  assert.equal(rows[1].dose, '20mg')
})

/* ------------------------------------------------------------------ *
 * 4. Happy path: full guest → account migration
 * ------------------------------------------------------------------ */

test('migrates a guest session end-to-end: report + labs + conditions + meds + file + stamp', async () => {
  const fakes = makeFakes()
  const result = await runMigration(makeSession(), USER, fakes)

  assert.equal(result.status, 'migrated')
  if (result.status !== 'migrated') return

  // Report record (Step C)
  assert.equal(fakes.store.reports.length, 1)
  const report = fakes.store.reports[0]
  assert.equal(report.patient_id, USER)
  assert.equal(report.title, 'blood-report.pdf')
  assert.equal(report.file_path, 'user_clerk_1/blood-report.pdf')
  assert.equal(report.mime_type, 'application/pdf')
  assert.equal(report.ai_summary, 'Fasting glucose is elevated at 145 mg/dL.')
  assert.equal(report.status, 'ready')

  // Extracted rows (Steps D, E, F) — linked to the new report
  assert.equal(fakes.store.labs.length, 1)
  assert.equal(fakes.store.labs[0].report_id, report.id)
  assert.equal(fakes.store.labs[0].patient_id, USER)
  assert.equal(fakes.store.labs[0].test_name, 'Fasting Glucose')
  assert.equal(fakes.store.conditions.length, 1)
  assert.equal(fakes.store.conditions[0].name, 'Type 2 Diabetes')
  assert.equal(fakes.store.medications.length, 1)
  assert.equal(fakes.store.medications[0].name, 'Metformin')

  // Storage move (Step B): guest path → user path
  assert.equal(fakes.storageCalls.length, 1)
  assert.deepEqual(fakes.storageCalls[0], {
    from: '__guest__/tok_123.pdf',
    to: 'user_clerk_1/blood-report.pdf',
    contentType: 'application/pdf',
  })

  // Session stamped (Step G)
  assert.equal(fakes.store.stamps.length, 1)
  assert.equal(fakes.store.stamps[0].token, 'tok_123')
  assert.equal(fakes.store.stamps[0].userId, USER)

  assert.equal(result.fileMovedOk, true)
  assert.deepEqual(result.counts, { labs: 1, conditions: 1, medications: 1 })
  assert.deepEqual(result.warnings, [])
})

/* ------------------------------------------------------------------ *
 * 5. Idempotency + ownership (spec Step A)
 * ------------------------------------------------------------------ */

test('second run for the same session is already-migrated and creates no second report', async () => {
  const fakes = makeFakes()
  const session = makeSession()

  const first = await runMigration(session, USER, fakes)
  assert.equal(first.status, 'migrated')

  // The endpoint stamps the row; simulate by reading the stamp back.
  const stamped = makeSession({ migrated_user_id: USER })
  const second = await runMigration(stamped, USER, fakes)

  assert.equal(second.status, 'already-migrated')
  if (second.status !== 'already-migrated') return
  assert.equal(second.reportId, fakes.store.reports[0].id)
  assert.equal(fakes.store.reports.length, 1) // no duplicate row
})

test('session already migrated to ANOTHER account is rejected with no writes', async () => {
  const fakes = makeFakes()
  const result = await runMigration(makeSession({ migrated_user_id: 'user_other' }), USER, fakes)

  assert.equal(result.status, 'owned-elsewhere')
  assert.equal(fakes.store.reports.length, 0)
  assert.equal(fakes.store.stamps.length, 0)
})

test('expired session short-circuits before any write', async () => {
  const fakes = makeFakes()
  const result = await runMigration(
    makeSession({ created_at: new Date(Date.now() - MIGRATION_WINDOW_MS - 1).toISOString() }),
    USER,
    fakes,
  )
  assert.equal(result.status, 'expired')
  assert.equal(fakes.store.reports.length, 0)
  assert.equal(fakes.storageCalls.length, 0)
})

test('analysis-not-ready session short-circuits before any write', async () => {
  const fakes = makeFakes()
  const result = await runMigration(
    makeSession({ summary: null, lab_results: [], medications: [], conditions: [] }),
    USER,
    fakes,
  )
  assert.equal(result.status, 'analysis-not-ready')
  assert.equal(fakes.store.reports.length, 0)
})

test('same upload already in the library → duplicate guard, stamps, no second row', async () => {
  const fakes = makeFakes()
  // Pre-existing report with the same title + same analysis.
  fakes.store.reports.push({
    id: 'rep-existing',
    patient_id: USER,
    title: 'blood-report.pdf',
    file_path: 'user_clerk_1/blood-report.pdf',
    mime_type: 'application/pdf',
    ai_summary: 'Fasting glucose is elevated at 145 mg/dL.',
    status: 'ready',
  })

  const result = await runMigration(makeSession(), USER, fakes)

  assert.equal(result.status, 'duplicate')
  if (result.status !== 'duplicate') return
  assert.equal(result.reportId, 'rep-existing')
  assert.equal(fakes.store.reports.length, 1)
  assert.equal(fakes.store.stamps.length, 1) // session still closed off
  assert.equal(fakes.storageCalls.length, 0) // no file moved
})

/* ------------------------------------------------------------------ *
 * 6. Error handling (spec "Error Handling" table)
 * ------------------------------------------------------------------ */

test('storage file not found → report record is still created (non-fatal)', async () => {
  const fakes = makeFakes({ storageFails: true })
  const result = await runMigration(makeSession(), USER, fakes)

  assert.equal(result.status, 'migrated')
  if (result.status !== 'migrated') return
  assert.equal(result.fileMovedOk, false)
  assert.equal(fakes.store.reports[0].file_path, '__guest__/tok_123.pdf') // original path kept
  assert.equal(result.warnings.length, 1)
  assert.match(result.warnings[0], /storage move/)
})

test('guest copy gone but user copy present (partial earlier move) → user path is used', async () => {
  const fakes = makeFakes({ storageFails: true, targetExists: true })
  const result = await runMigration(makeSession(), USER, fakes)

  assert.equal(result.status, 'migrated')
  assert.equal(fakes.store.reports[0].file_path, 'user_clerk_1/blood-report.pdf')
})

test('report insert failure → error result, nothing else written, no stamp (retry possible)', async () => {
  const fakes = makeFakes({ reportInsertFails: true })
  const result = await runMigration(makeSession(), USER, fakes)

  assert.equal(result.status, 'error')
  assert.equal(fakes.store.labs.length, 0)
  assert.equal(fakes.store.conditions.length, 0)
  assert.equal(fakes.store.medications.length, 0)
  assert.equal(fakes.store.stamps.length, 0)
})

test('dependent insert failure is non-fatal: report still migrates, warning surfaced', async () => {
  const fakes = makeFakes({ labInsertFails: true })
  const result = await runMigration(makeSession(), USER, fakes)

  assert.equal(result.status, 'migrated')
  if (result.status !== 'migrated') return
  assert.equal(fakes.store.reports.length, 1)
  assert.equal(result.warnings.some((w) => w.startsWith('lab_results:')), true)
  assert.equal(fakes.store.stamps.length, 1)
})

test('stamp failure is surfaced as a warning but the report is kept', async () => {
  const fakes = makeFakes({ stampFails: true })
  const result = await runMigration(makeSession(), USER, fakes)

  assert.equal(result.status, 'migrated')
  if (result.status !== 'migrated') return
  assert.equal(result.warnings.some((w) => w.startsWith('markMigrated:')), true)
})

/* ------------------------------------------------------------------ *
 * 7. Result-shape contract used by the HTTP route
 * ------------------------------------------------------------------ */

test('every migration result carries a discriminant the route can map to HTTP', async () => {
  const cases: MigrationResult[] = [
    await runMigration(makeSession(), USER, makeFakes()),
    await runMigration(makeSession({ migrated_user_id: USER }), USER, makeFakes()),
    await runMigration(makeSession({ migrated_user_id: 'other' }), USER, makeFakes()),
    await runMigration(makeSession({ created_at: '2020-01-01T00:00:00.000Z' }), USER, makeFakes()),
    await runMigration(makeSession({ summary: null, lab_results: [], medications: [], conditions: [] }), USER, makeFakes()),
    await runMigration(makeSession(), USER, makeFakes({ reportInsertFails: true })),
  ]
  const statuses = cases.map((c) => c.status)
  assert.deepEqual(statuses, [
    'migrated',
    'already-migrated',
    'owned-elsewhere',
    'expired',
    'analysis-not-ready',
    'error',
  ])
})
