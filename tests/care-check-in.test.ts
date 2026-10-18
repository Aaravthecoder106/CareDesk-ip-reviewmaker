import test from 'node:test'
import assert from 'node:assert/strict'
import { parseNaturalLanguageCheckIn } from '../src/lib/care/check-in.ts'

test('parses blood pressure, glucose and weight without inferring missing values', () => {
  const result = parseNaturalLanguageCheckIn('BP 120/80, blood sugar 110 mg/dL, weight 65 kg')
  assert.equal(result.readings.length, 3)
  assert.deepEqual(result.readings[0], { vital_type: 'blood_pressure', systolic: 120, diastolic: 80 })
  assert.deepEqual(result.readings[1], { vital_type: 'glucose', glucose_mg_dl: 110 })
  assert.deepEqual(result.readings[2], { vital_type: 'weight', weight_kg: 65 })
})

test('rejects unsupported text rather than guessing a reading', () => {
  assert.deepEqual(parseNaturalLanguageCheckIn('feeling okay today'), { readings: [], unsupported: true })
})

test('rejects values outside database constraints', () => {
  assert.throws(() => parseNaturalLanguageCheckIn('BP 20/10'))
  assert.throws(() => parseNaturalLanguageCheckIn('sugar 0'))
  assert.throws(() => parseNaturalLanguageCheckIn('weight 0 kg'))
})

test('rejects glucose values with unsupported units instead of storing them as mg/dL', () => {
  assert.throws(() => parseNaturalLanguageCheckIn('blood sugar 5.5 mmol/L'), /Unsupported blood sugar unit/)
  assert.throws(() => parseNaturalLanguageCheckIn('glucose 110 mg/L'), /Unsupported blood sugar unit/)
})

test('accepts glucose explicitly expressed in mg/dL', () => {
  const result = parseNaturalLanguageCheckIn('blood sugar 110 mg/dL')
  assert.deepEqual(result.readings, [{ vital_type: 'glucose', glucose_mg_dl: 110 }])
})
