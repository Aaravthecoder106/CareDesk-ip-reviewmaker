import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { analyzeReport } from '@/lib/ai/analyze-report'
import { uploadLimiter } from '@/lib/rate-limit'
import { applyRateLimit, apiError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'])
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  // Browsers sometimes send these for PDFs
  'application/octet-stream',
  'application/x-pdf',
  'application/x-download',
])

function isAllowedFile(file: File): { ok: boolean; reason?: string } {
  if (ALLOWED_MIME_TYPES.has(file.type)) return { ok: true }
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext && ALLOWED_EXTENSIONS.has(ext)) return { ok: true }
  return { ok: false, reason: `Unsupported file type: ${file.type || 'unknown'} (${file.name}). Allowed: PDF, JPEG, PNG, WebP.` }
}

export async function POST(req: NextRequest) {
  const start = Date.now()
  let step = 'init'
  try {
    // Step 1: Auth
    step = 'auth'
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    // Step 2: Rate limit
    step = 'rate-limit'
    const rateLimited = applyRateLimit(req, uploadLimiter, userId)
    if (rateLimited) return rateLimited

    // Step 3: Content length check
    step = 'content-length-check'
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      return apiError(
        `File too large: ${(parseInt(contentLength, 10) / 1024 / 1024).toFixed(1)} MB. Maximum is 20 MB.`,
        400
      )
    }

    // Step 4: Parse form data
    step = 'parse-formdata'
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return apiError('No file provided', 400)

    logger.info({
      route: '/api/reports/upload',
      userId,
      step,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileSizeMB: (file.size / 1024 / 1024).toFixed(1),
    }, 'File received')

    // Step 5: Validate file type
    step = 'validate-type'
    const typeCheck = isAllowedFile(file)
    if (!typeCheck.ok) {
      return apiError(typeCheck.reason!, 400)
    }

    // Step 6: Validate file size
    step = 'validate-size'
    if (file.size > MAX_FILE_SIZE) {
      return apiError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is 20 MB.`, 400)
    }

    // Step 7: Create Supabase client
    step = 'create-supabase-client'
    const supabase = await createClerkSupabaseClient()

    // Step 8: Upload to storage
    step = 'storage-upload'
    const ext = file.name.split('.').pop() || 'bin'
    const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const contentType = file.type || (ext === 'pdf' ? 'application/pdf' : `image/${ext}`)

    logger.info({
      route: '/api/reports/upload',
      userId,
      step,
      filePath,
      contentType,
      fileSizeMB: (file.size / 1024 / 1024).toFixed(1),
    }, 'Uploading to Supabase storage')

    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(filePath, file, { contentType })

    if (uploadError) {
      logger.error({ route: '/api/reports/upload', userId, step, err: uploadError.message }, 'Storage upload failed')
      return apiError(`Upload failed (step: storage): ${uploadError.message}`, 500)
    }

    // Step 9: Insert report record
    step = 'db-insert'
    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        patient_id: userId,
        title: file.name.replace(/\.[^.]+$/, ''),
        file_path: filePath,
        mime_type: contentType,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      logger.error({ route: '/api/reports/upload', userId, step, err: insertError.message, errCode: insertError.code }, 'DB insert failed')
      return apiError(`Database error (step: insert): ${insertError.message}`, 500)
    }

    const durationMs = Date.now() - start
    logger.info({
      route: '/api/reports/upload',
      userId,
      reportId: report.id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: contentType,
      durationMs,
    }, 'Report uploaded, analysis queued')

    // Step 10: Queue background analysis
    step = 'queue-analysis'
    after(async () => {
      const analysisStart = Date.now()
      try {
        const result = await analyzeReport(report.id, filePath, contentType)
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
    const errorMsg = err instanceof Error ? err.message : String(err)
    const errorStack = err instanceof Error ? err.stack : undefined
    logger.error({
      route: '/api/reports/upload',
      step,
      durationMs,
      err: errorMsg,
      stack: errorStack,
    }, 'Report upload failed')
    // Return detailed error info for debugging
    return apiError(`Upload failed at step "${step}": ${errorMsg}`, 500)
  }
}
