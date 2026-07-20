import { NextRequest, NextResponse } from 'next/server'
import { acceptFamilyInvite } from '@/lib/data/family'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 400 })

    const result = await acceptFamilyInvite(token)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Accept failed' },
      { status: 500 }
    )
  }
}
