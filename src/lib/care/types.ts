export type CareStatus = 'GREEN' | 'YELLOW' | 'RED'

export type CareConsentStatus = 'pending' | 'active' | 'revoked' | 'expired'

export type CareStatusReason =
  | 'consent_pending'
  | 'consent_revoked'
  | 'consent_expired'
  | 'missed_dose'
  | 'out_of_range'
  | 'readings_pending'
  | 'medication_schedule_missing'
  | 'medication_log_incomplete'
  | 'baseline_missing'
  | 'all_good'

export interface CareVitalSummary {
  type: 'blood_pressure' | 'glucose' | 'weight'
  label: string
  value: string
  unit: string
  measured_at: string
}

export interface CareOverviewRecipient {
  id: string
  full_name: string
  date_of_birth: string | null
  age: number | null
  consent_status: CareConsentStatus
  status: CareStatus
  status_reason: CareStatusReason
  last_check_in_at: string | null
  latest_vitals: CareVitalSummary[]
  medication_summary: {
    active_medications: number
    taken_today: number
    expected_today: number
  }
  today_readings_count: number
}
