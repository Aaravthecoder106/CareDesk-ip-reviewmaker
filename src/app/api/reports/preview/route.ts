import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@/lib/supabase/client'
import { getReportUrl } from '@/lib/data/reports'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 })

    const supabase = await createClerkSupabaseClient()
    const { data: report } = await supabase
      .from('reports')
      .select('file_path')
      .eq('id', id)
      .eq('patient_id', userId)
      .single()

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const url = await getReportUrl(report.file_path)
    if (!url) return NextResponse.json({ error: 'Could not generate URL' }, { status: 500 })

    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Preview failed' },
      { status: 500 }
    )
  }
}
