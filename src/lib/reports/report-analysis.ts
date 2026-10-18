export type ReportLabFlag = 'normal' | 'high' | 'low' | 'critical'

export interface ExtractedVitalMetric {
  value: number | null
  rawValue: string | null
  unit: string | null
  referenceRange: string | null
  flag: ReportLabFlag | null
  sourceText: string | null
}

export interface ExtractedVitals {
  hba1c: ExtractedVitalMetric | null
  fastingBloodSugar: ExtractedVitalMetric | null
  totalCholesterol: ExtractedVitalMetric | null
  hemoglobin: ExtractedVitalMetric | null
  vitaminD: ExtractedVitalMetric | null
  vitaminB12: ExtractedVitalMetric | null
}

export interface ReportLabResult {
  test_name: string
  value: number | null
  unit: string | null
  flag: ReportLabFlag | null
}

export interface ReportMedication {
  name: string
  dose: string | null
  frequency: string | null
}

export interface ReportCondition {
  name: string
  status: string | null
}

export interface ReportAnalysis {
  /** Legacy alias retained for existing report consumers. Always English. */
  summary: string
  summaryEnglish: string
  summaryHinglish: string
  labResults: ReportLabResult[]
  medications: ReportMedication[]
  conditions: ReportCondition[]
  extractedVitals: ExtractedVitals
  questionsForDoctor: string[]
  medicalDisclaimer: string
}

export const MEDICAL_DISCLAIMER =
  'Medical disclaimer: This is an informational summary of the uploaded medical report, not a clinical diagnosis or treatment recommendation. AI extraction can be incomplete or incorrect and does not replace review by a qualified healthcare professional. Do not start, stop, or change medicines or treatment based on this summary. For urgent symptoms, seek emergency medical care.'

export const HINGLISH_FALLBACK =
  'Hinglish summary abhi generate nahi ho paaya. Kripya original report ko qualified doctor ke saath review karein; yeh summary medical advice ka replacement nahi hai.'

export const ENGLISH_FALLBACK =
  'A readable summary could not be generated from this report. Please review the original report with a qualified healthcare professional.'

export const REPORT_VITAL_FIELDS: { key: keyof ExtractedVitals; label: string }[] = [
  { key: 'hba1c', label: 'HbA1c' },
  { key: 'fastingBloodSugar', label: 'Fasting blood sugar' },
  { key: 'totalCholesterol', label: 'Total cholesterol' },
  { key: 'hemoglobin', label: 'Hemoglobin' },
  { key: 'vitaminD', label: 'Vitamin D' },
  { key: 'vitaminB12', label: 'Vitamin B12' },
]

const VALID_FLAGS = new Set<ReportLabFlag>(['normal', 'high', 'low', 'critical'])

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeFlag(value: unknown): ReportLabFlag | null {
  if (typeof value !== 'string') return null
  const flag = value.trim().toLowerCase()
  return VALID_FLAGS.has(flag as ReportLabFlag) ? flag as ReportLabFlag : null
}

function normalizeMetric(value: unknown): ExtractedVitalMetric | null {
  if (!isRecord(value)) return null
  const numericValue = finiteNumber(value.value)
  const rawValue = nonEmptyString(value.rawValue ?? value.raw_value)
    ?? (numericValue === null ? null : String(numericValue))

  if (numericValue === null && rawValue === null) return null

  return {
    value: numericValue,
    rawValue,
    unit: nonEmptyString(value.unit),
    referenceRange: nonEmptyString(value.referenceRange ?? value.reference_range),
    flag: normalizeFlag(value.flag),
    sourceText: nonEmptyString(value.sourceText ?? value.source_text),
  }
}

/** Safely coerce JSONB/LLM data to the six supported metric keys. */
export function normalizeExtractedVitals(value: unknown): ExtractedVitals {
  const input = isRecord(value) ? value : {}
  return {
    hba1c: normalizeMetric(input.hba1c ?? input.HbA1c),
    fastingBloodSugar: normalizeMetric(input.fastingBloodSugar ?? input.fasting_blood_sugar),
    totalCholesterol: normalizeMetric(input.totalCholesterol ?? input.total_cholesterol),
    hemoglobin: normalizeMetric(input.hemoglobin ?? input.Hemoglobin),
    vitaminD: normalizeMetric(input.vitaminD ?? input.vitamin_d),
    vitaminB12: normalizeMetric(input.vitaminB12 ?? input.vitamin_b12),
  }
}

function normalizeLabResults(value: unknown): ReportLabResult[] {
  if (!Array.isArray(value)) return []
  const results: ReportLabResult[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const testName = nonEmptyString(item.test_name ?? item.testName)
    if (!testName) continue
    results.push({
      test_name: testName,
      value: finiteNumber(item.value),
      unit: nonEmptyString(item.unit),
      flag: normalizeFlag(item.flag),
    })
  }
  return results
}

function normalizeMedications(value: unknown): ReportMedication[] {
  if (!Array.isArray(value)) return []
  const medications: ReportMedication[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const name = nonEmptyString(item.name)
    if (!name) continue
    medications.push({
      name,
      dose: nonEmptyString(item.dose),
      frequency: nonEmptyString(item.frequency),
    })
  }
  return medications
}

function normalizeConditions(value: unknown): ReportCondition[] {
  if (!Array.isArray(value)) return []
  const conditions: ReportCondition[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const name = nonEmptyString(item.name)
    if (!name) continue
    conditions.push({
      name,
      status: nonEmptyString(item.status),
    })
  }
  return conditions
}

function normalizeQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(nonEmptyString)
    .filter((question): question is string => question !== null)
    .slice(0, 5)
}

/**
 * If the model returns invalid JSON, keep useful plain prose but don't put a
 * JSON blob into the user-facing summary area.
 */
export function safeFallbackSummary(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || /^\s*(\{|\[)/.test(trimmed)) return null
  return trimmed
}

/** The disclaimer is hard-coded so an LLM cannot weaken or omit it. */
export function normalizeReportAnalysis(input: unknown, fallbackText = ''): ReportAnalysis {
  const source = isRecord(input) ? input : {}
  const summaryEnglish = nonEmptyString(source.summaryEnglish)
    ?? nonEmptyString(source.summary_english)
    ?? nonEmptyString(source.summary)
    ?? (safeFallbackSummary(fallbackText) ?? ENGLISH_FALLBACK)
  const summaryHinglish = nonEmptyString(source.summaryHinglish)
    ?? nonEmptyString(source.summary_hinglish)
    ?? HINGLISH_FALLBACK

  return {
    summary: summaryEnglish,
    summaryEnglish,
    summaryHinglish,
    labResults: normalizeLabResults(source.labResults ?? source.lab_results),
    medications: normalizeMedications(source.medications),
    conditions: normalizeConditions(source.conditions),
    extractedVitals: normalizeExtractedVitals(source.extractedVitals ?? source.extracted_vitals),
    questionsForDoctor: normalizeQuestions(source.questionsForDoctor ?? source.questions_for_doctor),
    medicalDisclaimer: MEDICAL_DISCLAIMER,
  }
}
