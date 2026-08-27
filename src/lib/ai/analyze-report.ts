import 'server-only'
import { generateTextWithImages, generateText, parseJsonReply } from './gemini'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { regenerateAnalyticsForUser } from '@/lib/data/analytics'
import { logger } from '@/lib/logger'

interface AnalysisResult {
  summary: string
  labResults: { test_name: string; value: number | null; unit: string | null; flag: string | null }[]
  medications: { name: string; dose: string | null; frequency: string | null }[]
  conditions: { name: string; status: string | null }[]
}

const ANALYSIS_PROMPT = `You are a medical report analyzer. Analyze the attached medical report (image or PDF) and extract structured data from its ACTUAL content. Do not invent data that is not present.

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

const TEXT_ANALYSIS_PROMPT = `You are a medical report analyzer. Below is the extracted text from a multi-page medical report. Analyze the text and extract structured data from its ACTUAL content. Do not invent data that is not present.

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

If a section has no data, use an empty array. For numeric values, use numbers not strings. For flags, use one of: normal, high, low, critical.

Extracted report text:
`

/** Maximum inline data size (bytes) before falling back to text extraction. */
const INLINE_LIMIT_BYTES = 8 * 1024 * 1024 // 8 MB

/**
 * Extract text content from a PDF buffer using pdf-parse.
 * Returns null if extraction fails or produces too little text.
 */
async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse(new Uint8Array(buffer))
    const data = await parser.getText()
    const text = (typeof data === 'string' ? data : data.text ?? '').trim()
    // If the extracted text is very short (likely a scanned/image PDF),
    // return null so the caller can try inline data instead.
    if (text.length < 100) return null
    return text
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'PDF text extraction failed')
    return null
  }
}

/**
 * Analyze an uploaded report: download the file from the private `reports`
 * bucket, send its content to Gemini, and persist the extracted data.
 * Runs with the service-role client (background pipeline). On any failure the
 * report is marked `failed` so the UI can offer a retry.
 *
 * Strategy for large PDFs:
 * 1. If the PDF is under 8MB, send it inline to Gemini (fast, preserves images).
 * 2. If the PDF is over 8MB, extract text first and send that to Gemini.
 * 3. If text extraction fails (scanned PDF), try inline anyway (may fail).
 * 4. If inline fails for a large PDF, report a clear error.
 */
export async function analyzeReport(
  reportId: string,
  filePath: string,
  mimeType: string
): Promise<{ ok: true; analysis: AnalysisResult } | { ok: false; error: string }> {
  const admin = createAdminSupabaseClient()

  try {
    await admin.from('reports').update({ status: 'processing' }).eq('id', reportId)

    // One lookup for the owner; everything below reuses it.
    const { data: report, error: reportError } = await admin
      .from('reports')
      .select('patient_id')
      .eq('id', reportId)
      .single()
    if (reportError || !report) throw new Error(`report lookup: ${reportError?.message || 'not found'}`)
    const patientId = report.patient_id

    // Download the actual file content.
    const { data: blob, error: dlError } = await admin.storage.from('reports').download(filePath)
    if (dlError || !blob) throw new Error(`storage download: ${dlError?.message || 'empty file'}`)

    const buffer = Buffer.from(await blob.arrayBuffer())
    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(1)
    const isPdf = mimeType === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf')

    logger.info({
      route: 'analyzeReport',
      reportId,
      mimeType,
      fileSizeMB,
      isPdf,
    }, 'Starting report analysis')

    let response: string

    if (isPdf && buffer.length > INLINE_LIMIT_BYTES) {
      // Large PDF: try text extraction first, fall back to inline
      logger.info({ reportId, fileSizeMB }, 'Large PDF detected, attempting text extraction')

      const extractedText = await extractPdfText(buffer)

      if (extractedText) {
        logger.info({ reportId, textLength: extractedText.length }, 'PDF text extracted successfully, sending to Gemini')

        // Truncate if extremely long (Gemini context limit)
        const maxChars = 100_000
        const truncatedText = extractedText.length > maxChars
          ? extractedText.slice(0, maxChars) + '\n\n[... truncated, text exceeded character limit ...]'
          : extractedText

        response = await generateText(TEXT_ANALYSIS_PROMPT + truncatedText)
      } else {
        // Text extraction failed (likely scanned/image PDF) — try inline
        logger.info({ reportId, fileSizeMB }, 'Text extraction yielded little content, trying inline data')

        const base64 = buffer.toString('base64')
        try {
          response = await generateTextWithImages(ANALYSIS_PROMPT, [
            { data: base64, mimeType },
          ])
        } catch (inlineErr) {
          const inlineMsg = inlineErr instanceof Error ? inlineErr.message : String(inlineErr)
          logger.error({ reportId, fileSizeMB, err: inlineMsg }, 'Inline data also failed for large PDF')
          throw new Error(
            `This PDF is too large (${fileSizeMB} MB) for inline analysis, and text extraction failed (the PDF may be a scanned document). ` +
            `Try: (1) compress the PDF, (2) split into smaller files, or (3) convert pages to images and upload those instead.`
          )
        }
      }
    } else {
      // Small PDF or image: send inline (preserves visual data)
      const base64 = buffer.toString('base64')
      response = await generateTextWithImages(ANALYSIS_PROMPT, [
        { data: base64, mimeType },
      ])
    }

    let parsed: AnalysisResult
    try {
      parsed = parseJsonReply<AnalysisResult>(response)
    } catch {
      // Model returned prose instead of JSON — keep the text as the summary.
      parsed = { summary: response, labResults: [], medications: [], conditions: [] }
    }
    parsed.labResults ??= []
    parsed.medications ??= []
    parsed.conditions ??= []

    // Re-analysis must not duplicate: replace this report's labs wholesale.
    await admin.from('lab_results').delete().eq('report_id', reportId)
    if (parsed.labResults.length > 0) {
      const { error } = await admin.from('lab_results').insert(
        parsed.labResults
          .filter((l) => l.test_name)
          .map((l) => ({
            report_id: reportId,
            patient_id: patientId,
            test_name: l.test_name,
            value: typeof l.value === 'number' ? l.value : null,
            unit: l.unit,
            flag: l.flag,
            test_date: new Date().toISOString(),
          }))
      )
      if (error) throw new Error(`lab_results insert: ${error.message}`)
    }

    // meds/conditions have no unique (patient_id, name) constraint, so dedupe
    // in code: insert only names the patient doesn't already have.
    if (parsed.medications.length > 0) {
      const { data: existing } = await admin
        .from('medications').select('name').eq('patient_id', patientId)
      const have = new Set((existing || []).map((m) => m.name.toLowerCase()))
      const fresh = parsed.medications.filter((m) => m.name && !have.has(m.name.toLowerCase()))
      if (fresh.length > 0) {
        const { error } = await admin.from('medications').insert(
          fresh.map((m) => ({
            patient_id: patientId,
            name: m.name,
            dose: m.dose,
            frequency: m.frequency,
          }))
        )
        if (error) throw new Error(`medications insert: ${error.message}`)
      }
    }

    if (parsed.conditions.length > 0) {
      const { data: existing } = await admin
        .from('conditions').select('name').eq('patient_id', patientId)
      const have = new Set((existing || []).map((c) => c.name.toLowerCase()))
      const fresh = parsed.conditions.filter((c) => c.name && !have.has(c.name.toLowerCase()))
      if (fresh.length > 0) {
        const { error } = await admin.from('conditions').insert(
          fresh.map((c) => ({ patient_id: patientId, name: c.name, status: c.status }))
        )
        if (error) throw new Error(`conditions insert: ${error.message}`)
      }
    }

    const { error: updateError } = await admin
      .from('reports')
      .update({ ai_summary: parsed.summary, status: 'ready' })
      .eq('id', reportId)
    if (updateError) throw new Error(`report update: ${updateError.message}`)

    // Family notifications: alert accepted family links about notable changes.
    await notifyFamilyOfFindings(admin, patientId, parsed).catch(() => {})

    // Auto-regenerate analytics snapshot
    await regenerateAnalyticsForUser(patientId).catch(() => {})

    logger.info({
      route: 'analyzeReport',
      reportId,
      labResults: parsed.labResults.length,
      medications: parsed.medications.length,
      conditions: parsed.conditions.length,
    }, 'Report analysis completed successfully')

    return { ok: true, analysis: parsed }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed'
    await admin.from('reports').update({ status: 'failed', ai_summary: `[Analysis failed] ${message}` }).eq('id', reportId)
    logger.error({ route: 'analyzeReport', reportId, err: message }, 'Report analysis failed')
    return { ok: false, error: message }
  }
}

/**
 * Notify every ACCEPTED family link (either direction)
 * when a new report contains abnormal lab flags.
 */
async function notifyFamilyOfFindings(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  patientId: string,
  analysis: AnalysisResult
) {
  const abnormal = analysis.labResults.filter((l) => l.flag && l.flag !== 'normal')
  const newMeds = analysis.medications.filter((m) => m.name)
  const newConditions = analysis.conditions.filter((c) => c.name)

  if (abnormal.length === 0 && newMeds.length === 0 && newConditions.length === 0) return

  const { data: links } = await admin
    .from('family_members')
    .select('owner_id, member_id')
    .eq('status', 'accepted')
    .or(`owner_id.eq.${patientId},member_id.eq.${patientId}`)
  if (!links || links.length === 0) return

  const { data: patient } = await admin
    .from('users').select('first_name, email').eq('id', patientId).maybeSingle()
  const who = patient?.first_name || patient?.email || 'A family member'

  const updates = []
  if (abnormal.length > 0) updates.push(`${abnormal.length} abnormal lab(s)`)
  if (newMeds.length > 0) updates.push(`new medication(s)`)
  if (newConditions.length > 0) updates.push(`new condition(s)`)

  const body = `${who} has new notable results: ${updates.join(', ')}.`

  const targets = links
    .map((l) => (l.owner_id === patientId ? l.member_id : l.owner_id))
    .filter((id, i, arr) => arr.indexOf(id) === i)

  await admin.from('notifications').insert(
    targets.map((userId) => ({
      user_id: userId,
      type: 'health_alert',
      title: 'Notable health change',
      body,
    }))
  )
}
