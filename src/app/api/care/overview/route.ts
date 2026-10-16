import { NextRequest, NextResponse } from 'next/server'
import { auditCareRead, careError, requireCaregiver, requestIp } from '@/lib/care/api'
import {
  evaluateCareStatus,
  latestCareTimestamp,
  latestCareVitals,
  type CareDoseRecord,
  type CareMedicationRecord,
  type CareThresholdRecord,
  type CareVitalRecord,
} from '@/lib/care/status'
import type { CareConsentStatus, CareOverviewRecipient, CareStatusReason } from '@/lib/care/types'

type RecipientRow = {
  id: string
  full_name: string
  date_of_birth: string | null
  created_at: string
}
type ConsentRow = {
  recipient_id: string
  status: CareConsentStatus
  accepted_at: string | null
  revoked_at: string | null
  expires_at: string
  created_at: string
}

function indiaDayBounds(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? ''
  const day = part('year') + '-' + part('month') + '-' + part('day')
  const start = new Date(day + 'T00:00:00+05:30')
  return {
    day,
    start: start.toISOString(),
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

function calculateAge(dateOfBirth: string | null, today: string): number | null {
  if (!dateOfBirth) return null
  const birth = new Date(dateOfBirth + 'T00:00:00Z')
  if (Number.isNaN(birth.getTime()) || birth.getTime() > Date.now()) return null
  const [year, month, day] = today.split('-').map(Number)
  let age = year - birth.getUTCFullYear()
  if (month < birth.getUTCMonth() + 1 || (month === birth.getUTCMonth() + 1 && day < birth.getUTCDate())) age -= 1
  return age >= 0 && age <= 125 ? age : null
}

function isWithinIndiaDay(value: string, start: string, end: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp >= Date.parse(start) && timestamp < Date.parse(end)
}

function isConsentActive(consent: ConsentRow | undefined) {
  // Once consent is accepted, expiry of the invitation token does not revoke access.
  return consent?.status === 'active' && Boolean(consent.accepted_at) && !consent.revoked_at
}

function consentDisplayStatus(consent: ConsentRow | undefined, now: number): CareConsentStatus {
  if (consent?.status === 'revoked' || consent?.revoked_at) return 'revoked'
  if (consent?.status === 'expired') return 'expired'
  if (consent?.status === 'pending' && new Date(consent.expires_at).getTime() <= now) return 'expired'
  return 'pending'
}

export async function GET(request: NextRequest) {
  const { userId, db, response } = await requireCaregiver()
  if (response) return response

  try {
    const now = Date.now()
    const { day, start, end } = indiaDayBounds(new Date(now))
    const { data: recipientData, error: recipientError } = await db
      .from('care_recipients')
      .select('id, full_name, date_of_birth, created_at')
      .eq('caregiver_id', userId)
      .order('created_at', { ascending: false })

    if (recipientError) return careError('Unable to load the family care dashboard', 500)

    const recipients = (recipientData ?? []) as RecipientRow[]
    if (recipients.length === 0) {
      return NextResponse.json({ recipients: [] }, {
        headers: { 'Cache-Control': 'private, no-store, max-age=0' },
      })
    }

    const ip = requestIp(request)
    await Promise.all(recipients.map((recipient) =>
      auditCareRead(db, userId, recipient.id, 'care_recipients', ip)
    ))

    const recipientIds = recipients.map((recipient) => recipient.id)
    const { data: consentData, error: consentError } = await db
      .from('care_consents')
      .select('recipient_id, status, accepted_at, revoked_at, expires_at, created_at')
      .in('recipient_id', recipientIds)
      .order('created_at', { ascending: false })

    if (consentError) return careError('Unable to verify parent consent', 500)

    await Promise.all(recipients.map((recipient) =>
      auditCareRead(db, userId, recipient.id, 'care_consents', ip)
    ))

    const consentByRecipient = new Map<string, ConsentRow>()
    for (const consent of (consentData ?? []) as ConsentRow[]) {
      // The query is newest-first, so the first consent record is the current one.
      if (!consentByRecipient.has(consent.recipient_id)) consentByRecipient.set(consent.recipient_id, consent)
    }

    const activeIds = recipients
      .filter((recipient) => isConsentActive(consentByRecipient.get(recipient.id)))
      .map((recipient) => recipient.id)

    let vitals: CareVitalRecord[] = []
    let medications: CareMedicationRecord[] = []
    let doses: CareDoseRecord[] = []
    let thresholds: CareThresholdRecord[] = []

    if (activeIds.length > 0) {
      const auditableResources = ['care_vitals', 'care_medications', 'care_medication_doses', 'care_thresholds']
      await Promise.all(activeIds.flatMap((recipientId) =>
        auditableResources.map((resource) => auditCareRead(db, userId, recipientId, resource, ip))
      ))

      const [vitalsResult, medicationsResult, dosesResult, thresholdsResult] = await Promise.all([
        db.from('care_vitals')
          .select('id, recipient_id, vital_type, systolic, diastolic, glucose_mg_dl, weight_kg, measured_at')
          .in('recipient_id', activeIds)
          .order('measured_at', { ascending: false })
          .limit(500),
        db.from('care_medications')
          .select('id, recipient_id, name, schedule')
          .in('recipient_id', activeIds)
          .eq('active', true)
          .limit(500),
        db.from('care_medication_doses')
          .select('id, medication_id, recipient_id, scheduled_for, status, logged_at')
          .in('recipient_id', activeIds)
          .order('scheduled_for', { ascending: false })
          .limit(1000),
        db.from('care_thresholds')
          .select('recipient_id, vital_type, min_value, max_value')
          .in('recipient_id', activeIds)
          .limit(500),
      ])

      if (vitalsResult.error || medicationsResult.error || dosesResult.error || thresholdsResult.error) {
        return careError('Unable to load consented health records', 500)
      }

      vitals = (vitalsResult.data ?? []) as CareVitalRecord[]
      medications = (medicationsResult.data ?? []) as CareMedicationRecord[]
      doses = (dosesResult.data ?? []) as CareDoseRecord[]
      thresholds = (thresholdsResult.data ?? []) as CareThresholdRecord[]
    }

    const profiles: CareOverviewRecipient[] = recipients.map((recipient) => {
      const consent = consentByRecipient.get(recipient.id)

      if (!isConsentActive(consent)) {
        const consentStatus = consentDisplayStatus(consent, now)
        const reasonCode: CareStatusReason = consentStatus === 'revoked'
          ? 'consent_revoked'
          : consentStatus === 'expired'
            ? 'consent_expired'
            : 'consent_pending'

        return {
          id: recipient.id,
          full_name: recipient.full_name,
          date_of_birth: recipient.date_of_birth,
          age: calculateAge(recipient.date_of_birth, day),
          consent_status: consentStatus,
          status: 'YELLOW',
          status_reason: reasonCode,
          last_check_in_at: null,
          latest_vitals: [],
          medication_summary: { active_medications: 0, taken_today: 0, expected_today: 0 },
          today_readings_count: 0,
        }
      }

      const recipientVitals = vitals.filter((vital) => vital.recipient_id === recipient.id)
      const recipientMedications = medications.filter((medication) => medication.recipient_id === recipient.id)
      const activeMedicationIds = new Set(recipientMedications.map((medication) => medication.id))
      const recipientDoses = doses.filter((dose) =>
        dose.recipient_id === recipient.id && activeMedicationIds.has(dose.medication_id)
      )
      const recipientThresholds = thresholds.filter((threshold) => threshold.recipient_id === recipient.id)
      const todayVitals = recipientVitals.filter((vital) => isWithinIndiaDay(vital.measured_at, start, end))
      const todayDoses = recipientDoses.filter((dose) => isWithinIndiaDay(dose.scheduled_for, start, end))
      const evaluation = evaluateCareStatus(todayVitals, todayDoses, recipientMedications, recipientThresholds)

      return {
        id: recipient.id,
        full_name: recipient.full_name,
        date_of_birth: recipient.date_of_birth,
        age: calculateAge(recipient.date_of_birth, day),
        consent_status: 'active',
        status: evaluation.status,
        status_reason: evaluation.reason_code,
        last_check_in_at: latestCareTimestamp([
          ...recipientVitals.map((vital) => vital.measured_at),
          ...recipientDoses.map((dose) => dose.logged_at),
        ]),
        latest_vitals: latestCareVitals(recipientVitals),
        medication_summary: evaluation.medication_summary,
        today_readings_count: evaluation.today_readings_count,
      }
    })

    return NextResponse.json({ recipients: profiles }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to load the family care dashboard' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    )
  }
}
