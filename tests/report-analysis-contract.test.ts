import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ENGLISH_FALLBACK,
  HINGLISH_FALLBACK,
  MEDICAL_DISCLAIMER,
  normalizeExtractedVitals,
  normalizeReportAnalysis,
  safeFallbackSummary,
} from '../src/lib/reports/report-analysis.ts'

test('normalizes bilingual summaries while retaining the legacy English summary alias', () => {
  const analysis = normalizeReportAnalysis({
    summaryEnglish: 'The report lists HbA1c 6.5%.',
    summaryHinglish: 'Report mein HbA1c 6.5% likha hai.',
    labResults: [],
    medications: [],
    conditions: [],
  })

  assert.equal(analysis.summary, 'The report lists HbA1c 6.5%.')
  assert.equal(analysis.summaryEnglish, 'The report lists HbA1c 6.5%.')
  assert.equal(analysis.summaryHinglish, 'Report mein HbA1c 6.5% likha hai.')
})

test('never trusts a model-supplied medical disclaimer', () => {
  const analysis = normalizeReportAnalysis({
    summaryEnglish: 'Summary',
    summaryHinglish: 'Hinglish summary',
    medicalDisclaimer: 'You can diagnose yourself from this result.',
  })

  assert.equal(analysis.medicalDisclaimer, MEDICAL_DISCLAIMER)
})

test('preserves a legacy summary and supplies a visible fallback for older records', () => {
  const analysis = normalizeReportAnalysis({ summary: 'Legacy English summary' })

  assert.equal(analysis.summaryEnglish, 'Legacy English summary')
  assert.equal(analysis.summary, 'Legacy English summary')
  assert.equal(analysis.summaryHinglish, HINGLISH_FALLBACK)
})

test('does not turn missing biomarkers into zero and preserves source notation', () => {
  const vitals = normalizeExtractedVitals({
    hba1c: { value: 6.5, rawValue: '6.5', unit: '%', referenceRange: 'as printed', flag: 'high' },
    fastingBloodSugar: { value: null, rawValue: '<5', unit: 'mmol/L', referenceRange: null, flag: 'unknown' },
    totalCholesterol: null,
  })

  assert.equal(vitals.hba1c?.value, 6.5)
  assert.equal(vitals.hba1c?.flag, 'high')
  assert.equal(vitals.fastingBloodSugar?.value, null)
  assert.equal(vitals.fastingBloodSugar?.rawValue, '<5')
  assert.equal(vitals.fastingBloodSugar?.flag, null)
  assert.equal(vitals.totalCholesterol, null)
  assert.equal(vitals.vitaminB12, null)
})

test('ignores malformed metric values and unknown keys safely', () => {
  const vitals = normalizeExtractedVitals({
    hba1c: { value: '6.5', unit: '%' },
    vitamin_d: { value: Number.NaN, raw_value: 'not readable' },
    unrelatedField: { value: 123 },
  })

  assert.equal(vitals.hba1c, null)
  assert.equal(vitals.vitaminD?.value, null)
  assert.equal(vitals.vitaminD?.rawValue, 'not readable')
  assert.equal('unrelatedField' in vitals, false)
})

test('normalizes lab results and drops malformed rows', () => {
  const analysis = normalizeReportAnalysis({
    summaryEnglish: 'Summary',
    labResults: [
      { test_name: 'HbA1c', value: 6.5, unit: '%', flag: 'high' },
      { test_name: 'Unknown flag', value: 1, unit: null, flag: 'urgent' },
      { value: 7, unit: 'mg/dL' },
      null,
    ],
  })

  assert.equal(analysis.labResults.length, 2)
  assert.equal(analysis.labResults[0]?.flag, 'high')
  assert.equal(analysis.labResults[1]?.flag, null)
})

test('limits doctor-discussion prompts to five and removes empty/non-string entries', () => {
  const analysis = normalizeReportAnalysis({
    questionsForDoctor: [
      'Question 1',
      '',
      'Question 2',
      4,
      'Question 3',
      'Question 4',
      'Question 5',
      'Question 6',
    ],
  })

  assert.deepEqual(analysis.questionsForDoctor, [
    'Question 1',
    'Question 2',
    'Question 3',
    'Question 4',
    'Question 5',
  ])
})

test('keeps useful plain prose as a fallback summary', () => {
  const analysis = normalizeReportAnalysis({}, 'The report appears to list a complete blood count.')
  assert.equal(analysis.summaryEnglish, 'The report appears to list a complete blood count.')
})

test('rejects raw JSON blobs as visible fallback summaries', () => {
  const jsonBlob = '{"summaryEnglish":"unparsed","labResults":[{"value":7}]}'
  assert.equal(safeFallbackSummary(jsonBlob), null)
  assert.equal(normalizeReportAnalysis({}, jsonBlob).summaryEnglish, ENGLISH_FALLBACK)
})

test('uses a safe non-diagnostic fallback if the model returns no summary', () => {
  const analysis = normalizeReportAnalysis({})
  assert.equal(analysis.summaryEnglish, ENGLISH_FALLBACK)
  assert.equal(analysis.summary, ENGLISH_FALLBACK)
  assert.equal(analysis.medicalDisclaimer, MEDICAL_DISCLAIMER)
})
