import { NextResponse } from 'next/server'
import { getPendingInvites } from '@/lib/data/family'

export async function GET() {
  try {
    const invites = await getPendingInvites()
    return NextResponse.json({ invites })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch invites' },
      { status: 500 }
    )
  }
}
