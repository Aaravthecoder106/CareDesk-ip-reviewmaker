import { NextResponse } from 'next/server'
import { getFamilyMembers } from '@/lib/data/family'

export async function GET() {
  try {
    const members = await getFamilyMembers()
    return NextResponse.json({ members })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch members' },
      { status: 500 }
    )
  }
}
