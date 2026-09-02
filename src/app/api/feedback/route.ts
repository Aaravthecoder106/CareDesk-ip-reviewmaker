import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-helpers'
import { feedbackSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const body = await req.json()
    const parsed = feedbackSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    }

    const { wouldUse, liked, missing } = parsed.data
    const user = await currentUser()
    const email = user?.emailAddresses?.[0]?.emailAddress || null

    const admin = createAdminSupabaseClient()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    const { error } = await admin.from('feedback').insert({
      user_id: userId,
      email,
      would_use: wouldUse,
      liked: liked || null,
      missing: missing || null,
    } as never)

    if (error) {
      // Handle missing table gracefully (migration not applied yet)
      if (error.code === '42P01') {
        logger.warn({ route: '/api/feedback', error: error.message }, 'Feedback table not found — run migration 0003')
        return apiError('Feedback table not found. Run the migration SQL in Supabase dashboard.', 502)
      }
      logger.error({ route: '/api/feedback', userId, err: error.message }, 'Feedback insert failed')
      return apiError(error.message, 502)
    }

    const durationMs = Date.now() - start
    logger.info({ route: '/api/feedback', userId, wouldUse, durationMs }, 'Feedback submitted')

    return NextResponse.json({ ok: true })
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error({
      route: '/api/feedback',
      durationMs,
      err: err instanceof Error ? err.message : String(err),
    }, 'Feedback failed')
    return apiError(err instanceof Error ? err.message : 'Feedback failed')
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return apiError('Unauthorized', 401)

    const admin = createAdminSupabaseClient()
    const { data, error } = await admin
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({
          error: 'Feedback table not found. Run the migration SQL in Supabase dashboard.',
          data: [],
        })
      }
      logger.error({ route: '/api/feedback:GET', err: error.message }, 'Failed to fetch feedback')
      return apiError(error.message, 502)
    }

    logger.debug({ route: '/api/feedback:GET', count: data?.length ?? 0 }, 'Feedback listed')
    return NextResponse.json({ data: data || [] })
  } catch (err) {
    logger.error({
      route: '/api/feedback:GET',
      err: err instanceof Error ? err.message : String(err),
    }, 'Failed to fetch feedback')
    return apiError(err instanceof Error ? err.message : 'Failed to fetch feedback')
  }
}
