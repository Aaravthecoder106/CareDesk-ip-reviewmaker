export type ParsedCheckInVital =
  | { vital_type: 'blood_pressure'; systolic: number; diastolic: number; glucose_mg_dl?: never; weight_kg?: never }
  | { vital_type: 'glucose'; glucose_mg_dl: number; systolic?: never; diastolic?: never; weight_kg?: never }
  | { vital_type: 'weight'; weight_kg: number; systolic?: never; diastolic?: never; glucose_mg_dl?: never }

export interface CheckInParseResult {
  readings: ParsedCheckInVital[]
  unsupported: boolean
}

/**
 * Deterministic parser for the supported pilot format. It deliberately does
 * not infer values or use an LLM; ambiguous/unrecognized text is rejected.
 * Examples: "BP 120/80, sugar 110, weight 65 kg".
 */
export function parseNaturalLanguageCheckIn(input: string): CheckInParseResult {
  const text = input.toLowerCase().replace(/,/g, ' ')
  const readings: ParsedCheckInVital[] = []

  const bp = text.match(/\b(?:bp|blood pressure|blood-pressure)\s*(?:is|:|=)?\s*(\d{2,3})\s*\/\s*(\d{2,3})\b/)
  if (bp) {
    const systolic = Number(bp[1])
    const diastolic = Number(bp[2])
    if (systolic < 40 || systolic > 300 || diastolic < 20 || diastolic > 200) {
      throw new Error('Blood pressure is outside the accepted input range. Please check the numbers.')
    }
    readings.push({ vital_type: 'blood_pressure', systolic, diastolic })
  }

  const glucose = text.match(/\b(?:blood sugar|blood glucose|glucose|sugar)\s*(?:is|:|=)?\s*(\d{1,4}(?:\.\d{1,2})?)\s*(mg\s*\/\s*dl|mmol\s*\/\s*l|mg\s*\/\s*l)?\b/)
  if (glucose) {
    const unit = glucose[2]?.replace(/\s+/g, '').toLowerCase()
    if (unit && unit !== 'mg/dl') {
      throw new Error('Unsupported blood sugar unit. Use mg/dL or omit the unit.')
    }
    const value = Number(glucose[1])
    if (!Number.isFinite(value) || value < 1 || value > 2000) {
      throw new Error('Blood sugar is outside the accepted input range. Please check the number.')
    }
    readings.push({ vital_type: 'glucose', glucose_mg_dl: value })
  }

  const weight = text.match(/\b(?:weight|weighs?)\s*(?:is|:|=)?\s*(\d{1,4}(?:\.\d{1,2})?)\s*(?:kg|kilograms?)\b/)
  if (weight) {
    const value = Number(weight[1])
    if (!Number.isFinite(value) || value < 1 || value > 1000) {
      throw new Error('Weight is outside the accepted input range. Please check the number.')
    }
    readings.push({ vital_type: 'weight', weight_kg: value })
  }

  return { readings, unsupported: readings.length === 0 }
}
