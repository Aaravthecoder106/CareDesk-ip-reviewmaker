import { NextResponse } from 'next/server'
import { regenerateAnalytics } from '@/lib/data/analytics'

export async function POST() {
  try {
    const result = await regenerateAnalytics()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analytics generation failed' },
      { status: 500 }
    )
  }
}
