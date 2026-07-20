import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { analyzeReport } from '@/lib/ai/analyze-report'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { reportId } = await req.json()
    if (!reportId) return NextResponse.json({ error: 'No reportId' }, { status: 400 })

    const supabase = await createClerkSupabaseClient()
    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('patient_id', userId)
      .single()

    if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    await supabase.from('reports').update({ status: 'processing' }).eq('id', reportId)

    const result = await analyzeReport(report.id, report.file_path, report.mime_type || 'application/pdf')

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}
