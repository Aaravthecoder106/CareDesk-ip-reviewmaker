import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

export async function getReports(): Promise<Tables<'reports'>[]> {
  const { userId } = await auth()
  if (!userId) return []

  const supabase = await createClerkSupabaseClient()
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('patient_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getReports: ${error.message}`)
  return data || []
}

export async function getReport(id: string): Promise<Tables<'reports'> | null> {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = await createClerkSupabaseClient()
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .eq('patient_id', userId)
    .single()

  if (error) return null
  return data
}

export async function createReport(
  title: string,
  filePath: string,
  mimeType: string
): Promise<Tables<'reports'> | null> {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = await createClerkSupabaseClient()
  const { data, error } = await supabase
    .from('reports')
    .insert({
      patient_id: userId,
      title,
      file_path: filePath,
      mime_type: mimeType,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw new Error(`createReport: ${error.message}`)
  return data
}

export async function deleteReport(id: string): Promise<boolean> {
  const { userId } = await auth()
  if (!userId) return false

  const supabase = await createClerkSupabaseClient()

  const { data: report } = await supabase
    .from('reports')
    .select('file_path')
    .eq('id', id)
    .eq('patient_id', userId)
    .single()

  if (report) {
    await supabase.storage.from('reports').remove([report.file_path])
  }

  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('id', id)
    .eq('patient_id', userId)

  return !error
}

export async function getReportUrl(filePath: string): Promise<string | null> {
  const supabase = await createClerkSupabaseClient()
  const { data } = await supabase.storage
    .from('reports')
    .createSignedUrl(filePath, 3600)

  return data?.signedUrl || null
}
