import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { ensureCurrentUserProvisioned } from '@/lib/data/users'
import { runMigration, type MigrationDb, type MigrationStorage } from '@/lib/guest-migration'
import { logger } from '@/lib/logger'

/**
 * POST /api/public/migrate
 *
 * Migrates a guest preview session into the authenticated user's account so
 * the report appears in their Report Library with the full analysis unlocked.
 *
 * "public" only in the middleware sense (no forced redirect): Clerk auth is
 * validated here, and only an authenticated user may migrate data.
 *
 * Body: { previewToken: string }
 *
 *   1. auth() + body parse
 *   2. ensureCurrentUserProvisioned() — guarantees the users/patients rows the
 *      reports/lab_results/conditions/medications FKs point at. Without this,
 *      a signup whose Clerk webhook has not landed yet fails the insert.
 *   3. load preview_tokens row (must exist)
 *   4. runMigration() — validate → move file → insert rows → stamp session
 *   5. map the result onto an HTTP response
 */

const ROUTE = '/api/public/migrate'

interface MigrateBody {
  previewToken?: string
}

export async function POST(req: NextRequest) {
  const start = Date.now()

  try {
    // ── Auth ───────────────────────────────────────────────────────────
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    // ── Body ───────────────────────────────────────────────────────────
    let body: MigrateBody
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    const { previewToken } = body
    if (!previewToken || typeof previewToken !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing previewToken' }, { status: 400 })
    }

    // ── Provision BEFORE any insert (FK: reports.patient_id → patients) ─
    try {
      await ensureCurrentUserProvisioned()
    } catch (provErr) {
      const msg = provErr instanceof Error ? provErr.message : String(provErr)
      logger.error({ route: ROUTE, step: 'provision', userId, err: msg }, 'Provisioning failed')
      return NextResponse.json(
        { success: false, error: 'Your account is still being set up. Try again in a moment.' },
        { status: 503 },
      )
    }

    const admin = createAdminSupabaseClient()

    // ── Step A: retrieve the guest session ─────────────────────────────
    const { data: session, error: sessionError } = await admin
      .from('preview_tokens')
      .select('*')
      .eq('token', previewToken)
      .single()

    if (sessionError || !session) {
      logger.warn({ route: ROUTE, token: previewToken.slice(0, 8) }, 'Preview token not found')
      return NextResponse.json({ success: false, error: 'Preview session not found' }, { status: 404 })
    }

    // ── Steps B–G ──────────────────────────────────────────────────────
    const result = await runMigration(session, userId, {
      db: makeDb(admin),
      storage: makeStorage(admin),
    })

    const durationMs = Date.now() - start

    switch (result.status) {
      case 'migrated': {
        logger.info(
          {
            route: ROUTE,
            userId,
            reportId: result.reportId,
            fileMovedOk: result.fileMovedOk,
            counts: result.counts,
            warnings: result.warnings,
            durationMs,
          },
          'Guest migration completed successfully',
        )
        return NextResponse.json({
          success: true,
          reportId: result.reportId,
          redirect: '/dashboard/reports',
        })
      }

      case 'already-migrated':
        logger.info({ route: ROUTE, userId, reportId: result.reportId, durationMs }, 'Session already migrated')
        return NextResponse.json({
          success: true,
          reportId: result.reportId,
          alreadyMigrated: true,
          redirect: '/dashboard/reports',
        })

      case 'duplicate':
        logger.info({ route: ROUTE, userId, reportId: result.reportId, durationMs }, 'Report already in library')
        return NextResponse.json({
          success: true,
          reportId: result.reportId,
          duplicate: true,
          redirect: '/dashboard/reports',
        })

      case 'owned-elsewhere':
        return NextResponse.json(
          { success: false, error: 'This session has already been migrated to another account' },
          { status: 409 },
        )

      case 'expired':
        logger.info({ route: ROUTE, token: previewToken.slice(0, 8), durationMs }, 'Guest session expired')
        return NextResponse.json({ success: false, error: result.message }, { status: 410 })

      case 'analysis-not-ready':
        // Retryable: session stays alive, the client may try again shortly.
        return NextResponse.json({ success: false, error: result.message }, { status: 425 })

      case 'error':
        logger.error({ route: ROUTE, userId, durationMs }, 'Migration failed to create report')
        return NextResponse.json({ success: false, error: result.message }, { status: 500 })

      default:
        logger.error({ route: ROUTE, userId, durationMs }, 'Unhandled migration result')
        return NextResponse.json(
          { success: false, error: 'Migration failed. Please try uploading again.' },
          { status: 500 },
        )
    }
  } catch (err) {
    const durationMs = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ route: ROUTE, durationMs, err: msg }, 'Migration failed')
    return NextResponse.json(
      { success: false, error: `Migration failed: ${msg.slice(0, 200)}` },
      { status: 500 },
    )
  }
}

/* ------------------------------------------------------------------ *
 * Supabase-backed implementations of the pure core's interfaces
 * ------------------------------------------------------------------ */

function makeDb(admin: ReturnType<typeof createAdminSupabaseClient>): MigrationDb {
  return {
    async findDuplicateReport(patientId, title, summary) {
      const { data, error } = await admin
        .from('reports')
        .select('id, ai_summary')
        .eq('patient_id', patientId)
        .eq('title', title)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error || !data || data.length === 0) return null

      // Same filename is common ("report.pdf") — only treat it as the same
      // upload when the analysis matches too. Without a summary to compare,
      // fall back to the newest same-title report.
      if (summary) {
        const match = data.find((row) => row.ai_summary === summary)
        return match ? match.id : null
      }
      return data[0].id
    },

    async insertReport(row) {
      const { data, error } = await admin.from('reports').insert(row).select('id').single()
      if (error || !data) {
        logger.error({ route: ROUTE, step: 'report-insert', err: error?.message }, 'Failed to create report record')
        return { ok: false, error: error?.message }
      }
      return { ok: true, id: data.id }
    },

    async insertLabRows(rows) {
      const { error } = await admin.from('lab_results').insert(rows)
      return { ok: !error, error: error?.message }
    },

    async insertConditionRows(rows) {
      const { error } = await admin.from('conditions').insert(rows)
      return { ok: !error, error: error?.message }
    },

    async insertMedicationRows(rows) {
      const { error } = await admin.from('medications').insert(rows)
      return { ok: !error, error: error?.message }
    },

    async markMigrated(token, userId, migratedAtIso) {
      const { error } = await admin
        .from('preview_tokens')
        .update({ migrated_user_id: userId, migrated_at: migratedAtIso })
        .eq('token', token)
      return { ok: !error, error: error?.message }
    },
  }
}

function makeStorage(admin: ReturnType<typeof createAdminSupabaseClient>): MigrationStorage {
  const bucket = admin.storage.from('reports')

  return {
    async moveFile(from, to, contentType) {
      try {
        const { data: fileData, error: downloadError } = await bucket.download(from)
        if (downloadError || !fileData) {
          return { ok: false, error: downloadError?.message || 'guest file not found' }
        }

        const { error: uploadError } = await bucket.upload(to, fileData, { contentType, upsert: true })
        if (uploadError) return { ok: false, error: uploadError.message }

        // Best-effort cleanup of the guest copy.
        await bucket.remove([from]).catch(() => undefined)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },

    async exists(path) {
      const slash = path.lastIndexOf('/')
      const dir = slash >= 0 ? path.slice(0, slash) : ''
      const name = slash >= 0 ? path.slice(slash + 1) : path
      const { data } = await bucket.list(dir, { search: name, limit: 1 })
      return !!data && data.some((entry) => entry.name === name)
    },
  }
}
