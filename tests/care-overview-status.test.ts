import test from 'node:test'
import assert from 'node:assert/strict'

import {
  evaluateCareStatus,
  expectedDoseCount,
  type CareDoseRecord,
  type CareMedicationRecord,
  type CareThresholdRecord,
  type CareVitalRecord,
} from '../src/lib/care/status.ts'

const now = '2026-10-16T04:00:00.000Z'
const bloodPressure: CareVitalRecord = {
  id: 'bp-1',
  recipient_id: 'parent-1',
  vital_type: 'blood_pressure',
  systolic: 128,
  diastolic: 82,
  glucose_mg_dl: null,
  weight_kg: null,
  measured_at: now,
}
const bloodSugar: CareVitalRecord = {
  id: 'glucose-1',
  recipient_id: 'parent-1',
  vital_type: 'glucose',
  systolic: null,
  diastolic: null,
  glucose_mg_dl: 110,
  weight_kg: null,
  measured_at: now,
}
const medications: CareMedicationRecord[] = [{
  id: 'med-1',
  recipient_id: 'parent-1',
  name: 'Example medicine',
  schedule: 'Daily',
}]
const takenDose: CareDoseRecord = {
  id: 'dose-1',
  medication_id: 'med-1',
  recipient_id: 'parent-1',
  scheduled_for: now,
  status: 'taken',
  logged_at: now,
}
const baselines: CareThresholdRecord[] = [
  { recipient_id: 'parent-1', vital_type: 'blood_pressure_systolic', min_value: 90, max_value: 140 },
  { recipient_id: 'parent-1', vital_type: 'blood_pressure_diastolic', min_value: 60, max_value: 90 },
  { recipient_id: 'parent-1', vital_type: 'glucose', min_value: 70, max_value: 130 },
]

test('Green requires both core readings, complete medication logs, and personal baselines', () => {
  const result = evaluateCareStatus([bloodPressure, bloodSugar], [takenDose], medications, baselines)
  assert.equal(result.status, 'GREEN')
  assert.equal(result.medication_summary.taken_today, 1)
  assert.equal(result.medication_summary.expected_today, 1)
})

test('status stays Yellow when personal baseline ranges are missing', () => {
  const result = evaluateCareStatus([bloodPressure, bloodSugar], [takenDose], medications, [])
  assert.equal(result.status, 'YELLOW')
  assert.equal(result.reason_code, 'baseline_missing')
})

test('a missed medication dose makes the status Red', () => {
  const missed = { ...takenDose, id: 'dose-2', status: 'missed' as const }
  const result = evaluateCareStatus([bloodPressure, bloodSugar], [takenDose, missed], medications, baselines)
  assert.equal(result.status, 'RED')
  assert.equal(result.reason_code, 'missed_dose')
})

test('a reading outside the configured range makes the status Red', () => {
  const highBloodPressure = { ...bloodPressure, systolic: 160 }
  const result = evaluateCareStatus([highBloodPressure, bloodSugar], [takenDose], medications, baselines)
  assert.equal(result.status, 'RED')
  assert.equal(result.reason_code, 'out_of_range')
})

test('status stays Yellow when either core reading is absent', () => {
  const result = evaluateCareStatus([bloodPressure], [takenDose], medications, baselines)
  assert.equal(result.status, 'YELLOW')
  assert.equal(result.reason_code, 'readings_pending')
})

test('status stays Yellow when medication records are incomplete', () => {
  const result = evaluateCareStatus([bloodPressure, bloodSugar], [], medications, baselines)
  assert.equal(result.status, 'YELLOW')
  assert.equal(result.reason_code, 'medication_log_incomplete')
})

test('schedule parsing recognizes common schedules and does not guess unknown ones', () => {
  assert.equal(expectedDoseCount('Daily'), 1)
  assert.equal(expectedDoseCount('Twice daily'), 2)
  assert.equal(expectedDoseCount('Every 8 hours'), 3)
  assert.equal(expectedDoseCount('Morning, after lunch, and at bedtime'), null)
})

test('an unclear medication schedule prevents Green status', () => {
  const unclearMedication = { ...medications[0], schedule: 'As directed' }
  const result = evaluateCareStatus([bloodPressure, bloodSugar], [takenDose], [unclearMedication], baselines)
  assert.equal(result.status, 'YELLOW')
  assert.equal(result.reason_code, 'medication_schedule_review')
})
