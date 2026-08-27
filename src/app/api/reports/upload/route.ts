import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { analyzeReport } from '@/lib/ai/analyze-report'
import { uploadLimiter } from '@/lib/rate-limit'
import { applyRateLimit, apiError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    // Rate limit: 10 uploads per 5 min
    const rateLimited = applyRateLimit(req, uploadLimiter, userId)
    if (rateLimited) return rateLimited

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return apiError('No file provided', 400)

    // Validate file type
    if (!ALLOWED_TYPES.has(file.type)) {
      return apiError(
        `Unsupported file type: ${file.type}. Allowed: PDF, JPEG, PNG, WebP.`,
        400,
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return apiError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is 20 MB.`, 400)
    }

    const supabase = await createClerkSupabaseClient()
    const ext = file.name.split('.').pop() || 'bin'
    const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(filePath, file, { contentType: file.type })

    if (uploadError) {
      logger.error({ route: '/api/reports/upload', userId, err: uploadError.message }, 'Storage upload failed')
      return apiError(`Upload failed: ${uploadError.message}`, 500)
    }

    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        patient_id: userId,
        title: file.name.replace(/\.[^.]+$/, ''),
        file_path: filePath,
        mime_type: file.type,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      logger.error({ route: '/api/reports/upload', userId, err: insertError.message }, 'DB insert failed')
      return apiError(`Database error: ${insertError.message}`, 500)
    }

    const durationMs = Date.now() - start
    logger.info({
      route: '/api/reports/upload',
      userId,
      reportId: report.id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      durationMs,
    }, 'Report uploaded, analysis queued')

    // Analyze in the background AFTER the response is sent
    after(async () => {
      const analysisStart = Date.now()
      try {
        const result = await analyzeReport(report.id, filePath, file.type)
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

    return NextResponse.json({ ok: true, report })
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/reports/upload',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Report upload failed')
    return apiError(err instanceof Error ? err.message : 'Upload failed')
  }
}
