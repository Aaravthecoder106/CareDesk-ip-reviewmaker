import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { generateTextWithImages } from '@/lib/ai/gemini'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const GUEST_ID = '__guest__'

const TEASER_PROMPT = `You are a medical report analyzer. Analyze the attached medical report and extract structured data.

Return a JSON object with this exact structure (no markdown, just raw JSON):
{
  "summary": "A clear 2-3 sentence summary of the report",
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

If a section has no data, use an empty array. For numeric values, use numbers not strings. For flags, use one of: normal, high, low, critical.`

/**
 * POST /api/public/analyze
 * Public endpoint — no auth required. Accepts a file upload, runs AI analysis,
 * stores everything under a guest ID, and returns a preview token.
 *
 * This powers the "try before you sign up" flow on the landing page.
 */
export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    // Quick health-check: if env vars are missing, return a clear message
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'placeholder') {
      return NextResponse.json({
        error: 'AI service not configured. Please set GEMINI_API_KEY in your environment variables.',
      }, { status: 503 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'placeholder') {
      return NextResponse.json({
        error: 'Database not configured. Please set SUPABASE_SERVICE_ROLE_KEY in your environment variables.',
      }, { status: 503 })
    }

    const contentType = req.headers.get('content-type') || ''

    // Only accept FormData uploads for the public route (simpler, no presign needed)
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Send a file as multipart/form-data' }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large. Maximum is 20 MB.` }, { status: 400 })
    }

    // Validate file type
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)
    const isPdf = ext === 'pdf'
    if (!isImage && !isPdf) {
      return NextResponse.json({ error: 'Only PDF and image files are accepted.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()

    // Generate a preview token
    const token = crypto.randomBytes(32).toString('hex')
    const mimeType = file.type || (isPdf ? 'application/pdf' : `image/${ext}`)

    // Try to upload file to guest storage (best-effort — preview works without it)
    const filePath = `${GUEST_ID}/${token}.${ext}`
    let storageOk = false
    try {
      const { error: uploadError } = await admin.storage
        .from('reports')
        .upload(filePath, file, { contentType: mimeType, upsert: false })
      if (uploadError) {
        logger.warn({ route: '/api/public/analyze', step: 'storage', err: uploadError.message }, 'Guest file upload failed (non-fatal)')
      } else {
        storageOk = true
      }
    } catch (e) {
      logger.warn({ route: '/api/public/analyze', step: 'storage', err: e instanceof Error ? e.message : String(e) }, 'Storage error (non-fatal)')
    }

    // Run AI analysis
    logger.info({ route: '/api/public/analyze', fileName: file.name, fileSizeMB: (file.size / 1024 / 1024).toFixed(1), mimeType }, 'Starting guest analysis')

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    let response: string
    try {
      response = await generateTextWithImages(TEASER_PROMPT, [
        { data: base64, mimeType },
      ])
    } catch (aiErr) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr)
      logger.error({ route: '/api/public/analyze', step: 'ai', err: msg }, 'AI analysis failed')
      return NextResponse.json({
        error: `AI analysis failed: ${msg.includes('API key') ? 'Invalid or missing GEMINI_API_KEY' : msg.slice(0, 200)}`,
      }, { status: 500 })
    }

    // Parse the AI response
    let analysis: {
      summary: string
      labResults: { test_name: string; value: number | null; unit: string | null; flag: string | null }[]
      medications: { name: string; dose: string | null; frequency: string | null }[]
      conditions: { name: string; status: string | null }[]
    }

    try {
      // Strip markdown code fences if present
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      analysis = JSON.parse(cleaned)
    } catch {
      analysis = { summary: response, labResults: [], medications: [], conditions: [] }
    }

    analysis.labResults ??= []
    analysis.medications ??= []
    analysis.conditions ??= []

    // Store the preview result (best-effort — if table is missing, still return token via query param)
    let dbOk = false
    try {
      const { error: insertError } = await admin.from('preview_tokens').insert({
        token,
        file_path: storageOk ? filePath : '',
        mime_type: mimeType,
        file_name: file.name,
        summary: analysis.summary,
        lab_results: analysis.labResults,
        medications: analysis.medications,
        conditions: analysis.conditions,
      })
      if (insertError) {
        if (insertError.code === '42P01') {
          // Table doesn't exist — tell the user to run the migration
          logger.error({ route: '/api/public/analyze', step: 'db-insert' }, 'preview_tokens table missing — run migration 0005')
          return NextResponse.json({
            error: 'Setup required: run the 0005_preview_tokens.sql migration in your Supabase dashboard. Go to SQL Editor and paste the migration from supabase/migrations/0005_preview_tokens.sql.',
          }, { status: 500 })
        }
        logger.error({ route: '/api/public/analyze', step: 'db-insert', err: insertError.message }, 'Preview token insert failed')
      } else {
        dbOk = true
      }
    } catch (e) {
      logger.warn({ route: '/api/public/analyze', step: 'db-insert', err: e instanceof Error ? e.message : String(e) }, 'DB insert error (non-fatal)')
    }

    const durationMs = Date.now() - start

    if (dbOk) {
      logger.info({ route: '/api/public/analyze', token, labResults: analysis.labResults.length, durationMs }, 'Guest analysis completed')
      return NextResponse.json({ token })
    }

    // Fallback: return analysis inline if DB storage failed
    logger.warn({ route: '/api/public/analyze', durationMs, dbOk, storageOk }, 'DB storage unavailable, returning analysis inline')
    return NextResponse.json({
      token: null,
      inline: true,
      summary: analysis.summary,
      labResults: analysis.labResults,
      medications: analysis.medications,
      conditions: analysis.conditions,
      fileName: file.name,
    })
  } catch (err) {
    const durationMs = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ route: '/api/public/analyze', durationMs, err: msg }, 'Guest analysis failed')
    return NextResponse.json({ error: `Analysis failed: ${msg.slice(0, 200)}` }, { status: 500 })
  }
}
