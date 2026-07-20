import { NextRequest, NextResponse } from 'next/server'
import { deleteReport } from '@/lib/data/reports'

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 })

    const ok = await deleteReport(id)
    return NextResponse.json({ ok })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 }
    )
  }
}
