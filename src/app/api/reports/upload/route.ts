import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { analyzeReport } from '@/lib/ai/analyze-report'
import { uploadLimiter } from '@/lib/rate-limit'
import { applyRateLimit, apiError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { getUserReportCount, getUserSubscription } from '@/lib/data/subscriptions'
import { getPlanLimits } from '@/lib/stripe'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest) {
  const start = Date.now()
  let step = 'init'
  try {
    step = 'auth'
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    step = 'rate-limit'
    const rateLimited = applyRateLimit(req, uploadLimiter, userId)
    if (rateLimited) return rateLimited

    // Check subscription upload limit
    step = 'check-limit'
    const [tier, reportCount] = await Promise.all([
      getUserSubscription(userId),
      getUserReportCount(userId),
    ])
    const limits = getPlanLimits(tier)
    if (limits.maxReports !== Infinity && reportCount >= limits.maxReports) {
      return apiError(
        `You've reached the ${limits.maxReports}-report limit on the Free plan. Upgrade to Pro for unlimited uploads.`,
        403
      )
    }

    const contentType = req.headers.get('content-type') || ''

    // Path A: Direct Supabase upload — client uploads file to storage directly,
    // then calls this route with just the metadata. This bypasses Vercel's body limit.
    if (contentType.includes('application/json')) {
      step = 'parse-json'
      const body = await req.json()
      const { filePath, fileName, mimeType, fileSize } = body as {
        filePath?: string
        fileName?: string
        mimeType?: string
        fileSize?: number
      }

      if (!filePath || !fileName) {
        return apiError('Missing filePath or fileName', 400)
      }

      if (fileSize && fileSize > MAX_FILE_SIZE) {
        return apiError(`File too large: ${(fileSize / 1024 / 1024).toFixed(1)} MB. Maximum is 20 MB.`, 400)
      }

      step = 'db-insert'
      const supabase = await createClerkSupabaseClient()
      const { data: report, error: insertError } = await supabase
        .from('reports')
        .insert({
          patient_id: userId,
          title: fileName.replace(/\.[^.]+$/, ''),
          file_path: filePath,
          mime_type: mimeType || 'application/pdf',
          status: 'pending',
        })
        .select()
        .single()

      if (insertError) {
        logger.error({ route: '/api/reports/upload', userId, step, err: insertError.message }, 'DB insert failed')
        return apiError(`Database error: ${insertError.message}`, 500)
      }

      step = 'queue-analysis'
      const finalMimeType = mimeType || 'application/pdf'
      after(async () => {
        const analysisStart = Date.now()
        try {
          const result = await analyzeReport(report.id, filePath, finalMimeType)
          logger.info({
            route: '/api/reports/upload:after',
            userId,
            reportId: report.id,
            ok: result.ok,
            analysisDurationMs: Date.now() - analysisStart,
          }, 'Background analysis completed')
        } catch (err) {
          logger.error({
            route: '/api/reports/upload:after',
            userId,
            reportId: report.id,
            err: err instanceof Error ? err.message : String(err),
          }, 'Background analysis failed')
        }
      })

      const durationMs = Date.now() - start
      logger.info({ route: '/api/reports/upload', userId, reportId: report.id, fileName, fileSize, mimeType: finalMimeType, durationMs, mode: 'direct' }, 'Report created after direct upload')

      return NextResponse.json({ ok: true, report })
    }

    // Path B: Traditional FormData upload — file goes through Vercel (for small files <4MB)
    step = 'parse-formdata'
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return apiError('No file provided', 400)

    logger.info({ route: '/api/reports/upload', userId, step, fileName: file.name, fileType: file.type, fileSizeMB: (file.size / 1024 / 1024).toFixed(1) }, 'File received via FormData')

    if (file.size > MAX_FILE_SIZE) {
      return apiError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is 20 MB.`, 400)
    }

    step = 'create-supabase-client'
    const supabase = await createClerkSupabaseClient()

    step = 'storage-upload'
    const ext = file.name.split('.').pop() || 'bin'
    const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const fileMimeType = file.type || (ext === 'pdf' ? 'application/pdf' : `image/${ext}`)

    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(filePath, file, { contentType: fileMimeType })

    if (uploadError) {
      logger.error({ route: '/api/reports/upload', userId, step, err: uploadError.message }, 'Storage upload failed')
      return apiError(`Upload failed: ${uploadError.message}`, 500)
    }

    step = 'db-insert'
    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        patient_id: userId,
        title: file.name.replace(/\.[^.]+$/, ''),
        file_path: filePath,
        mime_type: fileMimeType,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      logger.error({ route: '/api/reports/upload', userId, step, err: insertError.message }, 'DB insert failed')
      return apiError(`Database error: ${insertError.message}`, 500)
    }

    step = 'queue-analysis'
    after(async () => {
      const analysisStart = Date.now()
      try {
        const result = await analyzeReport(report.id, filePath, fileMimeType)
        logger.info({ route: '/api/reports/upload:after', userId, reportId: report.id, ok: result.ok, analysisDurationMs: Date.now() - analysisStart }, 'Background analysis completed')
      } catch (err) {
        logger.error({ route: '/api/reports/upload:after', userId, reportId: report.id, err: err instanceof Error ? err.message : String(err) }, 'Background analysis failed')
      }
    })

    const durationMs = Date.now() - start
    logger.info({ route: '/api/reports/upload', userId, reportId: report.id, fileName: file.name, fileSize: file.size, mimeType: fileMimeType, durationMs, mode: 'formdata' }, 'Report uploaded via FormData')

    return NextResponse.json({ ok: true, report })
  } catch (err) {
    const durationMs = Date.now() - start
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.error({ route: '/api/reports/upload', step, durationMs, err: errorMsg }, 'Report upload failed')
    return apiError(`Upload failed at step "${step}": ${errorMsg}`, 500)
  }
}
