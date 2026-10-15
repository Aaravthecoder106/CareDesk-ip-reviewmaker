import { NextRequest } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { apiError, applyRateLimit } from '@/lib/api-helpers'
import { uploadLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const uploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
})

const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp'])

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const rateLimited = applyRateLimit(req, uploadLimiter, userId)
    if (rateLimited) return rateLimited

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Invalid JSON body', 400)
    }

    const parsed = uploadRequestSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Provide a valid fileName and a fileSize between 1 byte and 20 MB.', 400)
    }

    const { fileName, fileSize } = parsed.data
    const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return apiError('Unsupported file type. Upload a PDF or an image (PNG, JPEG, WebP).', 400)
    }

    const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const admin = createAdminSupabaseClient()
    const { data, error } = await admin.storage
      .from('reports')
      .createSignedUploadUrl(filePath)

    if (error) {
      logger.error({ route: '/api/reports/presign', userId, err: error.message }, 'Failed to create signed URL')
      return apiError('Failed to create upload URL', 500)
    }

    logger.info({ route: '/api/reports/presign', userId, filePath, fileSize }, 'Signed URL created')

    return Response.json({
      ok: true,
      uploadUrl: data.signedUrl,
      filePath,
    })
  } catch (err) {
    logger.error({ route: '/api/reports/presign', err: err instanceof Error ? err.message : String(err) }, 'Presign failed')
    return apiError('Failed to create upload URL')
  }
}
