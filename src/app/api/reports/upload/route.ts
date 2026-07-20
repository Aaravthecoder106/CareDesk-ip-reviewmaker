import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { analyzeReport } from '@/lib/ai/analyze-report'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const supabase = await createClerkSupabaseClient()
    const ext = file.name.split('.').pop() || 'bin'
    const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(filePath, file, { contentType: file.type })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        patient_id: userId,
        title: file.name.replace(/\.[^.]+$/, ''),
        file_path: filePath,
        mime_type: file.type,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    // Analyze in the background AFTER the response is sent; `after()` keeps the
    // function alive on serverless so the job isn't frozen mid-flight.
    after(async () => {
      await analyzeReport(report.id, filePath, file.type)
    })

    return NextResponse.json({ ok: true, report })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
