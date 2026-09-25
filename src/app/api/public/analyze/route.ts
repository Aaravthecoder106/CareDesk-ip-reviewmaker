import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { generateTextWithImages, parseJsonReply } from '@/lib/ai/gemini'
import { logger } from '@/lib/logger'
import {
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_HEADER,
  GUEST_SESSION_TOKEN_COOKIE,
  isGuestSessionId,
} from '@/lib/guest-session'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const GUEST_SESSION_MAX_AGE = 24 * 60 * 60

const TEASER_PROMPT = `You are a medical report analyzer. Analyze the attached medical report and extract structured data.

Return a JSON object with this exact structure (no markdown, just raw JSON):
{
  "summary": "A clear 2-3 sentence summary of the report",
  "healthScore": 75,
  "insights": [
    "One concise, evidence-based insight",
    "A second concise, evidence-based insight when available"
  ],
  "labResults": [
    { "test_name": "Test Name", "value": 123.45, "unit": "mg/dL", "flag": "normal|high|low|critical" }
  ],
  "medications": [
    { "name": "Medication Name", "dose": "10mg", "frequency": "twice daily" }
  ],
  "conditions": [
    { "name": "Condition Name", "status": "active|resolved|chronic" }
  ]
}

Use an integer healthScore from 0 to 100 based only on the extracted report data. Return one or two concise insights and do not diagnose. If a section has no data, use an empty array. For numeric values, use numbers not strings. For flags, use one of: normal, high, low, critical.`

type GuestAnalysis = {
  summary: string
  healthScore: number
  insights: string[]
  labResults: { test_name: string; value: number | null; unit: string | null; flag: string | null }[]
  medications: { name: string; dose: string | null; frequency: string | null }[]
  conditions: { name: string; status: string | null }[]
}

type ClaimResult = {
  allowed: boolean
  reason?: 'invalid_session' | 'ip_limit' | 'session_limit'
  sessionId?: string
  expiresAt?: string
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function hashIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ipAddress = forwardedFor || req.headers.get('x-real-ip') || 'unknown'
  return crypto
    .createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'guest-session')
    .update(ipAddress)
    .digest('hex')
}

function guestJson(
  body: Record<string, unknown>,
  status: number,
  sessionId: string,
  token?: string,
): NextResponse {
  const response = NextResponse.json(body, { status })
  if (isGuestSessionId(sessionId)) {
    response.cookies.set(GUEST_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: GUEST_SESSION_MAX_AGE,
    })
  }
  if (token) {
    response.cookies.set(GUEST_SESSION_TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: GUEST_SESSION_MAX_AGE,
    })
  }
  return response
}

function calculateHealthScore(analysis: Pick<GuestAnalysis, 'labResults' | 'conditions'>): number {
  const flags = analysis.labResults.map((lab) => lab.flag)
  const activeConditions = analysis.conditions.filter((condition) => condition.status === 'active').length
  const penalty = flags.reduce((total, flag) => {
    if (flag === 'critical') return total + 12
    if (flag === 'high' || flag === 'low') return total + 5
    return total + 1
  }, 0)
  return Math.max(0, Math.min(100, 88 - penalty - activeConditions * 3))
}

function normalizeAnalysis(response: string): GuestAnalysis {
  let parsed: Partial<GuestAnalysis> = {}
  try {
    parsed = parseJsonReply<Partial<GuestAnalysis>>(response)
  } catch {
    parsed = { summary: response }
  }

  const labResults = Array.isArray(parsed.labResults) ? parsed.labResults : []
  const medications = Array.isArray(parsed.medications) ? parsed.medications : []
  const conditions = Array.isArray(parsed.conditions) ? parsed.conditions : []
  const requestedScore = typeof parsed.healthScore === 'number' ? parsed.healthScore : NaN
  const insights = Array.isArray(parsed.insights)
    ? parsed.insights.filter((insight): insight is string => typeof insight === 'string' && Boolean(insight.trim())).slice(0, 2)
    : []

  const analysis: GuestAnalysis = {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    healthScore: Number.isFinite(requestedScore)
      ? Math.max(0, Math.min(100, Math.round(requestedScore)))
      : calculateHealthScore({ labResults, conditions }),
    insights,
    labResults,
    medications,
    conditions,
  }

  if (analysis.insights.length === 0) {
    analysis.insights = ['The extracted values should be reviewed with a qualified healthcare professional.']
  }
  return analysis
}

export async function POST(req: NextRequest) {
  const start = Date.now()

  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'placeholder') {
      return NextResponse.json({ error: 'AI service not configured. Please set GEMINI_API_KEY in your environment variables.' }, { status: 503 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'placeholder') {
      return NextResponse.json({ error: 'Database not configured. Please set SUPABASE_SERVICE_ROLE_KEY in your environment variables.' }, { status: 503 })
    }

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Send a file as multipart/form-data' }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum is 20 MB.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)
    const isPdf = ext === 'pdf'
    if (!isImage && !isPdf) {
      return NextResponse.json({ error: 'Only PDF and image files are accepted.' }, { status: 400 })
    }

    const sessionId = req.headers.get(GUEST_SESSION_HEADER)
      || req.cookies.get(GUEST_SESSION_COOKIE)?.value
      || crypto.randomUUID()
    if (!isGuestSessionId(sessionId)) {
      return NextResponse.json({ error: 'Invalid guest session' }, { status: 400 })
    }

    const cookieToken = req.cookies.get(GUEST_SESSION_TOKEN_COOKIE)?.value
    const token = cookieToken && /^[0-9a-f]{64}$/.test(cookieToken)
      ? cookieToken
      : crypto.randomBytes(32).toString('hex')
    const tokenHash = sha256(token)
    const admin = createAdminSupabaseClient()
    const { data: claimData, error: claimError } = await admin.rpc('claim_guest_session', {
      p_session_id: sessionId,
      p_token_hash: tokenHash,
      p_ip_hash: hashIp(req),
    })

    if (claimError) {
      logger.error({ route: '/api/public/analyze', step: 'session-claim', code: claimError.code }, 'Guest session claim failed')
      const missingTable = claimError.code === '42P01' || claimError.code === '42883'
      return guestJson(
        {
          error: missingTable
            ? 'Setup required: run supabase/migrations/0007_guest_sessions.sql in your Supabase SQL editor.'
            : 'Unable to start this guest session. Please try again.',
        },
        500,
        sessionId,
      )
    }

    const claim = claimData as ClaimResult
    if (!claim.allowed) {
      if (claim.reason === 'ip_limit') {
        return guestJson(
          { error: 'This guest analysis limit has been reached. Please try again in 24 hours.' },
          429,
          sessionId,
          token,
        )
      }
      return guestJson(
        {
          error: claim.reason === 'session_limit'
            ? 'This browser session has already used its free report analysis.'
            : 'This guest session is invalid or expired.',
        },
        claim.reason === 'session_limit' ? 409 : 403,
        sessionId,
        token,
      )
    }

    const mimeType = file.type || (isPdf ? 'application/pdf' : `image/${ext}`)
    const filePath = `guest-uploads/${sessionId}/report-${Date.now()}.${ext}`
    let storageOk = false
    try {
      const { error: uploadError } = await admin.storage
        .from('reports')
        .upload(filePath, file, { contentType: mimeType, upsert: false })
      if (uploadError) {
        logger.warn({ route: '/api/public/analyze', step: 'storage', code: uploadError.status }, 'Guest file upload failed')
      } else {
        storageOk = true
      }
    } catch {
      logger.warn({ route: '/api/public/analyze', step: 'storage' }, 'Guest file upload failed')
    }

    logger.info({ route: '/api/public/analyze', mimeType, sizeBucket: file.size > 5 * 1024 * 1024 ? 'large' : 'standard' }, 'Starting guest analysis')

    let response: string
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      response = await generateTextWithImages(TEASER_PROMPT, [
        { data: buffer.toString('base64'), mimeType },
      ])
    } catch {
      await admin
        .from('guest_sessions')
        .update({ analysis_status: 'failed' })
        .eq('session_id', sessionId)
        .eq('token_hash', tokenHash)
      logger.error({ route: '/api/public/analyze', step: 'ai' }, 'Guest AI analysis failed')
      return guestJson({ error: 'AI analysis failed. Please try again later.' }, 500, sessionId, token)
    }

    const analysis = normalizeAnalysis(response)
    const report = {
      fileName: file.name,
      mimeType,
      fileSize: file.size,
      storagePath: storageOk ? filePath : null,
    }
    const { error: saveError } = await admin
      .from('guest_sessions')
      .update({
        report_storage_path: storageOk ? filePath : null,
        report,
        analysis,
        analysis_status: 'ready',
        health_score: analysis.healthScore,
        insights: analysis.insights,
      })
      .eq('session_id', sessionId)
      .eq('token_hash', tokenHash)
      .eq('upload_count', 1)

    if (saveError) {
      logger.error({ route: '/api/public/analyze', step: 'session-save', code: saveError.code }, 'Guest analysis save failed')
      return guestJson({ error: 'Unable to save this analysis. Please try again later.' }, 500, sessionId, token)
    }

    const durationMs = Date.now() - start
    logger.info({
      route: '/api/public/analyze',
      labResultCount: analysis.labResults.length,
      durationMs,
    }, 'Guest analysis completed')

    return guestJson(
      {
        sessionId,
        token,
        expiresAt: claim.expiresAt,
        data: analysis,
      },
      200,
      sessionId,
      token,
    )
  } catch {
    const durationMs = Date.now() - start
    logger.error({ route: '/api/public/analyze', durationMs }, 'Guest analysis failed')
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
