import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { reportPresignSchema } from '@/lib/validations'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp']

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const body = await req.json()
    const result = reportPresignSchema.safeParse(body)

    if (!result.success) {
      return apiError(result.error.issues[0].message, 400)
    }

    const { fileName, fileSize } = result.data

    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return apiError(`File too large: ${(fileSize / 1024 / 1024).toFixed(1)} MB. Maximum is 20 MB.`, 400)
    }

    const ext = fileName.split('.').pop()?.toLowerCase() || 'bin'
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return apiError(`Unsupported file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`, 400)
    }

    const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const admin = createAdminSupabaseClient()
    const { data, error } = await admin.storage
      .from('reports')
      .createSignedUploadUrl(filePath)

    if (error) {
      logger.error({ route: '/api/reports/presign', userId, err: error.message }, 'Failed to create signed URL')
      return apiError(`Failed to create upload URL: ${error.message}`, 500)
    }

    logger.info({ route: '/api/reports/presign', userId, filePath, fileName, fileSize }, 'Signed URL created')

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
