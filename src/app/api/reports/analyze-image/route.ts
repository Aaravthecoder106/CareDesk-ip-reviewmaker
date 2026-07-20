import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { getReportUrl } from '@/lib/data/reports'
import { generateTextWithImages } from '@/lib/ai/gemini'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { reportId } = await req.json()
    if (!reportId) return NextResponse.json({ error: 'No reportId' }, { status: 400 })

    const supabase = await createClerkSupabaseClient()
    const { data: report } = await supabase
      .from('reports')
      .select('file_path, mime_type')
      .eq('id', reportId)
      .eq('patient_id', userId)
      .single()

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const url = await getReportUrl(report.file_path)
    if (!url) return NextResponse.json({ error: 'Could not get file URL' }, { status: 500 })

    const response = await fetch(url)
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const prompt = `Analyze this medical report image. Extract all visible text, lab values, diagnoses, and medications. Provide a clear summary.`

    const result = await generateTextWithImages(prompt, [
      { data: base64, mimeType: report.mime_type || 'image/jpeg' },
    ])

    return NextResponse.json({ ok: true, summary: result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Image analysis failed' },
      { status: 500 }
    )
  }
}
