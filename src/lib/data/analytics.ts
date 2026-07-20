import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { generateText } from '@/lib/ai/gemini'
import type { Tables, Json } from '@/lib/supabase/types'

export async function getAnalytics(): Promise<Tables<'analytics_snapshots'> | null> {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = await createClerkSupabaseClient()
  const { data, error } = await supabase
    .from('analytics_snapshots')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw new Error(`getAnalytics: ${error.message}`)
  return data
}

export async function regenerateAnalytics(): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const { userId } = await auth()
    if (!userId) return { ok: false, error: 'Not authenticated' }

    const supabase = await createClerkSupabaseClient()

    const { data: labs } = await supabase
      .from('lab_results')
      .select('test_name, value, unit, flag, test_date')
      .eq('patient_id', userId)
      .order('test_date', { ascending: true })

    const { data: meds } = await supabase
      .from('medications')
      .select('name, dose, frequency, status')
      .eq('patient_id', userId)

    const { data: conditions } = await supabase
      .from('conditions')
      .select('name, status, diagnosed_at')
      .eq('patient_id', userId)

    const { data: reports } = await supabase
      .from('reports')
      .select('title, status, created_at')
      .eq('patient_id', userId)
      .order('created_at', { ascending: true })

    const prompt = `Generate health analytics data from this medical information. Return a JSON object with this structure:
{
  "labTrends": [
    { "test": "Test Name", "values": [{"date": "2024-01-01", "value": 100, "unit": "mg/dL", "flag": "normal"}] }
  ],
  "medicationSummary": { "active": 0, "total": 0 },
  "conditionSummary": { "active": 0, "resolved": 0, "chronic": 0 },
  "reportStats": { "total": 0, "processed": 0, "pending": 0 },
  "healthScore": 85,
  "insights": ["Insight 1", "Insight 2"]
}

Medical Data:
Labs: ${JSON.stringify(labs || [])}
Medications: ${JSON.stringify(meds || [])}
Conditions: ${JSON.stringify(conditions || [])}
Reports: ${JSON.stringify(reports || [])}`

    const response = await generateText(prompt)
    let analytics: Record<string, unknown>
    try {
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      analytics = JSON.parse(cleaned)
    } catch {
      analytics = {
        labTrends: [],
        medicationSummary: { active: meds?.length || 0, total: meds?.length || 0 },
        conditionSummary: { active: conditions?.filter(c => c.status === 'active').length || 0 },
        reportStats: { total: reports?.length || 0 },
        healthScore: 50,
        insights: ['Upload more reports for better insights'],
      }
    }

    await supabase
      .from('analytics_snapshots')
      .upsert(
        { user_id: userId, data: analytics as Json },
        { onConflict: 'user_id' }
      )

    return { ok: true, data: analytics }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Analytics generation failed' }
  }
}

export async function getFamilyAnalytics(): Promise<
  { user_id: string; name: string; data: Json }[]
> {
  const { userId } = await auth()
  if (!userId) return []

  const supabase = await createClerkSupabaseClient()
  // RLS returns own snapshot + accepted family members' snapshots.
  const { data, error } = await supabase
    .from('analytics_snapshots')
    .select('*')

  if (error) throw new Error(`getFamilyAnalytics: ${error.message}`)
  const others = (data || []).filter((s) => s.user_id !== userId)
  if (others.length === 0) return []

  // "family read linked user" policy exposes linked users' rows for names.
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name, email')
    .in('id', others.map((s) => s.user_id))

  const nameOf = new Map(
    (users || []).map((u) => [
      u.id,
      [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Family member',
    ])
  )

  return others.map((s) => ({
    user_id: s.user_id,
    name: nameOf.get(s.user_id) || 'Family member',
    data: s.data,
  }))
}
