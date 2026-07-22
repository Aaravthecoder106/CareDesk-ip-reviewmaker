import 'server-only'
import { generateTextWithImages, parseJsonReply } from './gemini'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { regenerateAnalyticsForUser } from '@/lib/data/analytics'

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

/**
 * Analyze an uploaded report: download the file from the private `reports`
 * bucket, send its content to Gemini, and persist the extracted data.
 * Runs with the service-role client (background pipeline). On any failure the
 * report is marked `failed` so the UI can offer a retry.
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

    // Download the actual file content and hand it to the model inline.
    const { data: blob, error: dlError } = await admin.storage.from('reports').download(filePath)
    if (dlError || !blob) throw new Error(`storage download: ${dlError?.message || 'empty file'}`)
    const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')

    const response = await generateTextWithImages(ANALYSIS_PROMPT, [
      { data: base64, mimeType: mimeType || 'application/pdf' },
    ])

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

    return { ok: true, analysis: parsed }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed'
    await admin.from('reports').update({ status: 'failed' }).eq('id', reportId)
    console.error(`[analyzeReport ${reportId}] ${message}`)
    return { ok: false, error: message }
  }
}

/**
 * Architecture: "both gets notification if any noticable changes occur in
 * their medical biology". Notify every ACCEPTED family link (either direction)
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
