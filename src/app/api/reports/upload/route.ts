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
  // Check MIME type
  if (ALLOWED_MIME_TYPES.has(file.type)) return { ok: true }

  // Fallback: check file extension (some browsers send wrong MIME type for PDFs)
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext && ALLOWED_EXTENSIONS.has(ext)) return { ok: true }

  return { ok: false, reason: `Unsupported file type: ${file.type || 'unknown'} (${file.name}). Allowed: PDF, JPEG, PNG, WebP.` }
}

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    // Rate limit: 10 uploads per 5 min
    const rateLimited = applyRateLimit(req, uploadLimiter, userId)
    if (rateLimited) return rateLimited

    // Check content length before parsing formData (Vercel body size limit)
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      return apiError(
        `File too large: ${(parseInt(contentLength, 10) / 1024 / 1024).toFixed(1)} MB. Maximum is 20 MB.`,
        400
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return apiError('No file provided', 400)

    // Validate file type (with extension fallback for wrong MIME types)
    const typeCheck = isAllowedFile(file)
    if (!typeCheck.ok) {
      return apiError(typeCheck.reason!, 400)
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return apiError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is 20 MB.`, 400)
    }

    const supabase = await createClerkSupabaseClient()
    const ext = file.name.split('.').pop() || 'bin'
    const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Determine the correct content type for storage
    const contentType = file.type || (ext === 'pdf' ? 'application/pdf' : `image/${ext}`)

    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(filePath, file, { contentType })

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
        mime_type: contentType,
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
      mimeType: contentType,
      durationMs,
    }, 'Report uploaded, analysis queued')

    // Analyze in the background AFTER the response is sent
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
    logger.error({
      route: '/api/reports/upload',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Report upload failed')
    return apiError(err instanceof Error ? err.message : 'Upload failed')
  }
}
