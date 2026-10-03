import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

/**
 * POST /api/public/migrate
 *
 * Migrates a guest preview session to the authenticated user's account.
 * This endpoint is "public" in the middleware sense (no forced redirect),
 * but it validates Clerk authentication internally — only authenticated
 * users can migrate data.
 *
 * Body: { previewToken: string }
 *
 * Process:
 *   1. Validate auth + token
 *   2. Fetch preview_tokens row (must exist, not expired, not already migrated)
 *   3. Move storage file from __guest__/{token}.{ext} → {userId}/{filename}
 *   4. Create permanent report row
 *   5. Insert lab_results, conditions, medications
 *   6. Mark preview_tokens as migrated
 *   7. Return the new report ID
 */
export async function POST(req: NextRequest) {
  const start = Date.now()

  try {
    // ── Auth check ──────────────────────────────────────────────────────
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    // ── Parse request body ──────────────────────────────────────────────
    let body: { previewToken?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 },
      )
    }

    const { previewToken } = body
    if (!previewToken || typeof previewToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing previewToken' },
        { status: 400 },
      )
    }

    const admin = createAdminSupabaseClient()

    // ── Step A: Retrieve & validate preview session ─────────────────────
    const { data: session, error: sessionError } = await admin
      .from('preview_tokens')
      .select('*')
      .eq('token', previewToken)
      .single()

    if (sessionError || !session) {
      logger.warn({ route: '/api/public/migrate', token: previewToken.slice(0, 8) }, 'Preview token not found')
      return NextResponse.json(
        { success: false, error: 'Preview session not found' },
        { status: 404 },
      )
    }

    // Check if already migrated
    if (session.migrated_user_id) {
      logger.info({ route: '/api/public/migrate', token: previewToken.slice(0, 8), migratedTo: session.migrated_user_id }, 'Session already migrated')

      // If same user, find their existing report and return it
      if (session.migrated_user_id === userId) {
        const { data: existingReport } = await admin
          .from('reports')
          .select('id')
          .eq('patient_id', userId)
          .eq('title', session.file_name)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        return NextResponse.json({
          success: true,
          reportId: existingReport?.id || null,
          alreadyMigrated: true,
        })
      }

      return NextResponse.json(
        { success: false, error: 'This session has already been migrated to another account' },
        { status: 409 },
      )
    }

    // Check expiry (48 hours for migration, more generous than preview's 24h)
    const createdAt = new Date(session.created_at)
    const ageMs = Date.now() - createdAt.getTime()
    if (ageMs > 48 * 60 * 60 * 1000) {
      return NextResponse.json(
        { success: false, error: 'Your preview session expired. Upload a new report from the dashboard.' },
        { status: 410 },
      )
    }

    // ── Step B: Move storage file ───────────────────────────────────────
    // Guest files are stored at: __guest__/{token}.{ext} in the 'reports' bucket
    const newFilePath = `${userId}/${session.file_name}`
    let fileMovedOk = false

    if (session.file_path && session.file_path.length > 0) {
      try {
        // Download from guest path
        const { data: fileData, error: downloadError } = await admin.storage
          .from('reports')
          .download(session.file_path)

        if (downloadError || !fileData) {
          logger.warn(
            { route: '/api/public/migrate', step: 'download', err: downloadError?.message },
            'Guest file download failed (non-fatal — report record will still be created)',
          )
        } else {
          // Upload to authenticated user's path
          const { error: uploadError } = await admin.storage
            .from('reports')
            .upload(newFilePath, fileData, {
              contentType: session.mime_type || 'application/pdf',
              upsert: true,
            })

          if (uploadError) {
            logger.warn(
              { route: '/api/public/migrate', step: 'upload', err: uploadError.message },
              'File upload to user path failed (non-fatal)',
            )
          } else {
            fileMovedOk = true

            // Clean up guest file (best-effort)
            await admin.storage
              .from('reports')
              .remove([session.file_path])
              .catch(() => {/* non-fatal */})
          }
        }
      } catch (storageErr) {
        logger.warn(
          { route: '/api/public/migrate', step: 'storage', err: storageErr instanceof Error ? storageErr.message : String(storageErr) },
          'Storage migration error (non-fatal)',
        )
      }
    }

    // If file wasn't moved, use the original path or empty
    const finalFilePath = fileMovedOk ? newFilePath : (session.file_path || '')

    // ── Step C: Create permanent report record ──────────────────────────
    const { data: report, error: reportError } = await admin
      .from('reports')
      .insert({
        patient_id: userId,
        title: session.file_name || 'Uploaded Report',
        file_path: finalFilePath,
        mime_type: session.mime_type || 'application/pdf',
        ai_summary: session.summary || null,
        status: 'ready',
      })
      .select('id')
      .single()

    if (reportError || !report) {
      logger.error(
        { route: '/api/public/migrate', step: 'report-insert', err: reportError?.message },
        'Failed to create report record',
      )
      return NextResponse.json(
        { success: false, error: 'Failed to create report. Please try uploading from the dashboard.' },
        { status: 500 },
      )
    }

    const reportId = report.id

    // ── Step D: Extract & insert lab results ────────────────────────────
    const labResults = (Array.isArray(session.lab_results) ? session.lab_results : []) as Record<string, unknown>[]
    if (labResults.length > 0) {
      try {
        const labRows = labResults.map((lab) => ({
          report_id: reportId,
          patient_id: userId,
          test_name: String(lab.test_name || lab.name || 'Unknown Test'),
          value: typeof lab.value === 'number' ? lab.value : null,
          unit: typeof lab.unit === 'string' ? lab.unit : null,
          flag: typeof lab.flag === 'string' ? lab.flag : null,
          test_date: null,
        }))

        const { error: labError } = await admin.from('lab_results').insert(labRows)
        if (labError) {
          logger.warn(
            { route: '/api/public/migrate', step: 'lab-results', err: labError.message, count: labRows.length },
            'Lab results insert failed (non-fatal)',
          )
        } else {
          logger.info({ route: '/api/public/migrate', count: labRows.length }, 'Lab results migrated')
        }
      } catch (e) {
        logger.warn({ route: '/api/public/migrate', step: 'lab-results-parse', err: e instanceof Error ? e.message : String(e) }, 'Lab results parse error')
      }
    }

    // ── Step E: Extract & insert conditions ──────────────────────────────
    const conditions = (Array.isArray(session.conditions) ? session.conditions : []) as Record<string, unknown>[]
    if (conditions.length > 0) {
      try {
        const condRows = conditions.map((cond) => ({
          patient_id: userId,
          name: String(cond.name || 'Unknown Condition'),
          status: typeof cond.status === 'string' ? cond.status : null,
          diagnosed_at: null,
        }))

        const { error: condError } = await admin.from('conditions').insert(condRows)
        if (condError) {
          logger.warn(
            { route: '/api/public/migrate', step: 'conditions', err: condError.message },
            'Conditions insert failed (non-fatal)',
          )
        } else {
          logger.info({ route: '/api/public/migrate', count: condRows.length }, 'Conditions migrated')
        }
      } catch (e) {
        logger.warn({ route: '/api/public/migrate', step: 'conditions-parse', err: e instanceof Error ? e.message : String(e) }, 'Conditions parse error')
      }
    }

    // ── Step F: Extract & insert medications ─────────────────────────────
    const medications = (Array.isArray(session.medications) ? session.medications : []) as Record<string, unknown>[]
    if (medications.length > 0) {
      try {
        const medRows = medications.map((med) => ({
          patient_id: userId,
          name: String(med.name || 'Unknown Medication'),
          dose: typeof med.dose === 'string' ? med.dose : null,
          frequency: typeof med.frequency === 'string' ? med.frequency : null,
          status: 'active',
        }))

        const { error: medError } = await admin.from('medications').insert(medRows)
        if (medError) {
          logger.warn(
            { route: '/api/public/migrate', step: 'medications', err: medError.message },
            'Medications insert failed (non-fatal)',
          )
        } else {
          logger.info({ route: '/api/public/migrate', count: medRows.length }, 'Medications migrated')
        }
      } catch (e) {
        logger.warn({ route: '/api/public/migrate', step: 'medications-parse', err: e instanceof Error ? e.message : String(e) }, 'Medications parse error')
      }
    }

    // ── Step G: Mark preview token as migrated ──────────────────────────
    const { error: updateError } = await admin
      .from('preview_tokens')
      .update({
        migrated_user_id: userId,
        migrated_at: new Date().toISOString(),
      })
      .eq('token', previewToken)

    if (updateError) {
      logger.warn(
        { route: '/api/public/migrate', step: 'mark-migrated', err: updateError.message },
        'Failed to mark token as migrated (non-fatal — report was created)',
      )
    }

    // ── Step H: Return success ──────────────────────────────────────────
    const durationMs = Date.now() - start
    logger.info(
      {
        route: '/api/public/migrate',
        userId,
        reportId,
        fileMovedOk,
        labResults: labResults.length,
        conditions: conditions.length,
        medications: medications.length,
        durationMs,
      },
      'Guest migration completed successfully',
    )

    return NextResponse.json({
      success: true,
      reportId,
      redirect: `/dashboard/reports`,
    })
  } catch (err) {
    const durationMs = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ route: '/api/public/migrate', durationMs, err: msg }, 'Migration failed')
    return NextResponse.json(
      { success: false, error: `Migration failed: ${msg.slice(0, 200)}` },
      { status: 500 },
    )
  }
}
