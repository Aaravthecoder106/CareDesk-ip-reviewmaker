import { NextResponse } from 'next/server'
import { getAnalytics, getFamilyAnalytics } from '@/lib/data/analytics'

export async function GET() {
  try {
    const [data, family] = await Promise.all([getAnalytics(), getFamilyAnalytics()])
    return NextResponse.json({ data: data?.data || null, family })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
