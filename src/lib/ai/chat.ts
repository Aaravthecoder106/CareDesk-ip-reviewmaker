import 'server-only'
import { generateText, generateTextWithImages } from './gemini'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { auth } from '@clerk/nextjs/server'

export async function chatWithAI(
  message: string,
  history: { role: string; content: string }[],
  image?: { data: string; mimeType: string }
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  try {
    const { userId } = await auth()
    if (!userId) return { ok: false, error: 'Not authenticated' }

    const supabase = await createClerkSupabaseClient()

    const { data: reports } = await supabase
      .from('reports')
      .select('id, title, ai_summary')
      .eq('patient_id', userId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(20)

    const { data: labs } = await supabase
      .from('lab_results')
      .select('test_name, value, unit, flag, test_date')
      .eq('patient_id', userId)
      .order('test_date', { ascending: false })
      .limit(50)

    const { data: meds } = await supabase
      .from('medications')
      .select('name, dose, frequency, status')
      .eq('patient_id', userId)
      .eq('status', 'active')

    const { data: conditions } = await supabase
      .from('conditions')
      .select('name, status')
      .eq('patient_id', userId)

    let context = `You are CareDesk AI, a helpful medical assistant. You have access to the user's medical data below. Answer questions clearly and helpfully. Always remind the user you are an AI and they should consult a healthcare professional for medical decisions.

User's Medical Data:
`

    if (reports && reports.length > 0) {
      context += `\nReports:\n${reports.map(r => `- ${r.title}: ${r.ai_summary || 'No summary yet'}`).join('\n')}`
    }
    if (labs && labs.length > 0) {
      context += `\n\nLab Results:\n${labs.map(l => `- ${l.test_name}: ${l.value} ${l.unit || ''} (${l.flag || 'normal'})`).join('\n')}`
    }
    if (meds && meds.length > 0) {
      context += `\n\nActive Medications:\n${meds.map(m => `- ${m.name} ${m.dose || ''} ${m.frequency || ''}`).join('\n')}`
    }
    if (conditions && conditions.length > 0) {
      context += `\n\nConditions:\n${conditions.map(c => `- ${c.name} (${c.status || 'active'})`).join('\n')}`
    }

    const conversationHistory = history.slice(-10).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n\n')

    const prompt = conversationHistory
      ? `${context}\n\nConversation:\n${conversationHistory}\n\nUser: ${message}\n\nAssistant:`
      : `${context}\n\nUser: ${message}\n\nAssistant:`

    const reply = image
      ? await generateTextWithImages(prompt, [image])
      : await generateText(prompt)

    await supabase.from('chat_messages').insert([
      { user_id: userId, role: 'user', content: image ? `${message} [image attached]` : message },
      { user_id: userId, role: 'assistant', content: reply },
    ])

    return { ok: true, reply }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Chat failed' }
  }
}
