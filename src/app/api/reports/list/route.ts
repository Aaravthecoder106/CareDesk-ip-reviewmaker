import { NextResponse } from 'next/server'
import { getReports } from '@/lib/data/reports'

export async function GET() {
  try {
    const reports = await getReports()
    return NextResponse.json({ reports })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}
