import { NextRequest, NextResponse } from 'next/server'
import { createFamilyInvite } from '@/lib/data/family'

export async function POST(req: NextRequest) {
  try {
    const { email, relation } = await req.json()
    if (!email) return NextResponse.json({ error: 'No email' }, { status: 400 })

    const result = await createFamilyInvite(email, relation)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invite failed' },
      { status: 500 }
    )
  }
}
