import type {
  CareStatus,
  CareStatusReason,
  CareVitalSummary,
} from './types'

export interface CareVitalRecord {
  id: string
  recipient_id: string
  vital_type: 'blood_pressure' | 'glucose' | 'weight'
  systolic: number | null
  diastolic: number | null
  glucose_mg_dl: number | string | null
  weight_kg: number | string | null
  measured_at: string
}

export interface CareMedicationRecord {
  id: string
  recipient_id: string
  name: string
  schedule: string | null
}

export interface CareDoseRecord {
  id: string
  medication_id: string
  recipient_id: string
  scheduled_for: string
  status: 'taken' | 'missed' | 'skipped'
  logged_at: string
}

export interface CareThresholdRecord {
  recipient_id: string
  vital_type: 'blood_pressure_systolic' | 'blood_pressure_diastolic' | 'glucose' | 'weight'
  min_value: number | string | null
  max_value: number | string | null
}

export interface CareStatusEvaluation {
  status: CareStatus
  reason_code: CareStatusReason
  medication_summary: {
    active_medications: number
    taken_today: number
    expected_today: number
  }
  today_readings_count: number
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function expectedDoseCount(schedule: string | null): number {
  const value = (schedule ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (/every\s*6\s*hours?|four times|4\s*(x|times?)|\bqid\b/.test(value)) return 4
  if (/every\s*8\s*hours?|thrice|three times|3\s*(x|times?)|\btid\b/.test(value)) return 3
  if (/every\s*12\s*hours?|twice|two times|2\s*(x|times?)|\bbid\b|morning.{0,20}(evening|night)|(evening|night).{0,20}morning/.test(value)) return 2
  if (/^(daily|once daily|once a day|once per day|every day|qd)$/.test(value) || /every\s*24\s*hours?/.test(value)) return 1
  // Zero marks an unrecognized schedule; it must never be treated as once daily.
  return 0
}

export function isOutOfConfiguredRange(vital: CareVitalRecord, thresholds: CareThresholdRecord[]) {
  const values: { type: CareThresholdRecord['vital_type']; value: number | null }[] = vital.vital_type === 'blood_pressure'
    ? [
        { type: 'blood_pressure_systolic', value: vital.systolic },
        { type: 'blood_pressure_diastolic', value: vital.diastolic },
      ]
    : vital.vital_type === 'glucose'
      ? [{ type: 'glucose', value: toNumber(vital.glucose_mg_dl) }]
      : [{ type: 'weight', value: toNumber(vital.weight_kg) }]

  return values.some(({ type, value }) => {
    if (value === null) return false
    const threshold = thresholds.find((item) => item.vital_type === type)
    if (!threshold) return false
    const min = toNumber(threshold.min_value)
    const max = toNumber(threshold.max_value)
    return (min !== null && value < min) || (max !== null && value > max)
  })
}

export function hasCompleteBaselines(thresholds: CareThresholdRecord[]) {
  const required: CareThresholdRecord['vital_type'][] = [
    'blood_pressure_systolic',
    'blood_pressure_diastolic',
    'glucose',
  ]
  return required.every((type) => {
    const threshold = thresholds.find((item) => item.vital_type === type)
    return threshold !== undefined
      && toNumber(threshold.min_value) !== null
      && toNumber(threshold.max_value) !== null
  })
}

function vitalSummary(vital: CareVitalRecord): CareVitalSummary {
  if (vital.vital_type === 'blood_pressure') {
    return {
      type: vital.vital_type,
      label: 'Blood pressure',
      value: String(vital.systolic ?? '—') + '/' + String(vital.diastolic ?? '—'),
      unit: 'mmHg',
      measured_at: vital.measured_at,
    }
  }
  if (vital.vital_type === 'glucose') {
    return {
      type: vital.vital_type,
      label: 'Blood sugar',
      value: String(toNumber(vital.glucose_mg_dl) ?? '—'),
      unit: 'mg/dL',
      measured_at: vital.measured_at,
    }
  }
  return {
    type: vital.vital_type,
    label: 'Weight',
    value: String(toNumber(vital.weight_kg) ?? '—'),
    unit: 'kg',
    measured_at: vital.measured_at,
  }
}

/** Expects readings ordered newest first; returns one card value per vital type. */
export function latestCareVitals(vitals: CareVitalRecord[]) {
  const seen = new Set<string>()
  const latest: CareVitalSummary[] = []
  for (const vital of vitals) {
    if (seen.has(vital.vital_type)) continue
    seen.add(vital.vital_type)
    latest.push(vitalSummary(vital))
  }
  const priority = { blood_pressure: 0, glucose: 1, weight: 2 }
  return latest.sort((a, b) => priority[a.type] - priority[b.type])
}

export function latestCareTimestamp(values: (string | null | undefined)[]) {
  const valid = values
    .filter((value): value is string => Boolean(value) && !Number.isNaN(new Date(value as string).getTime()))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  return valid[0] ?? null
}

/** Evaluate only data already scoped to one recipient and to today's log window. */
export function evaluateCareStatus(
  todayVitals: CareVitalRecord[],
  todayDoses: CareDoseRecord[],
  medications: CareMedicationRecord[],
  thresholds: CareThresholdRecord[],
): CareStatusEvaluation {
  const missedDose = todayDoses.some((dose) => dose.status === 'missed')
  const outOfRange = todayVitals.some((vital) => isOutOfConfiguredRange(vital, thresholds))
  const takenToday = todayDoses.filter((dose) => dose.status === 'taken').length
  const expectedCounts = medications.map((medication) => expectedDoseCount(medication.schedule))
  const expectedToday = expectedCounts.reduce((total, count) => total + count, 0)
  const allMedicationDosesTaken = medications.length > 0 && medications.every((medication, index) => {
    const expectedCount = expectedCounts[index] ?? 0
    if (expectedCount === 0) return false
    const medicationDoses = todayDoses.filter((dose) => dose.medication_id === medication.id)
    return medicationDoses.length >= expectedCount
      && medicationDoses.every((dose) => dose.status === 'taken')
  })
  const hasBloodPressureToday = todayVitals.some((vital) => vital.vital_type === 'blood_pressure')
  const hasBloodSugarToday = todayVitals.some((vital) => vital.vital_type === 'glucose')
  const hasCoreReadings = hasBloodPressureToday && hasBloodSugarToday
  const completeBaselines = hasCompleteBaselines(thresholds)

  let status: CareStatus = 'YELLOW'
  let reasonCode: CareStatusReason = 'medication_log_incomplete'

  if (missedDose) {
    status = 'RED'
    reasonCode = 'missed_dose'
  } else if (outOfRange) {
    status = 'RED'
    reasonCode = 'out_of_range'
  } else if (!hasCoreReadings) {
    reasonCode = 'readings_pending'
  } else if (medications.length === 0) {
    reasonCode = 'medication_schedule_missing'
  } else if (expectedCounts.some((count) => count === 0)) {
    reasonCode = 'medication_schedule_review'
  } else if (!allMedicationDosesTaken) {
    reasonCode = 'medication_log_incomplete'
  } else if (!completeBaselines) {
    reasonCode = 'baseline_missing'
  } else {
    status = 'GREEN'
    reasonCode = 'all_good'
  }

  return {
    status,
    reason_code: reasonCode,
    medication_summary: {
      active_medications: medications.length,
      taken_today: takenToday,
      expected_today: expectedToday,
    },
    today_readings_count: todayVitals.length,
  }
}
