import { NextRequest, NextResponse } from 'next/server'
import { confirmFamilyMember, removeFamilyMember } from '@/lib/data/family'

export async function POST(req: NextRequest) {
  try {
    const { memberId } = await req.json()
    if (!memberId) return NextResponse.json({ error: 'No memberId' }, { status: 400 })

    const result = await confirmFamilyMember(memberId)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Confirm failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')
    if (!memberId) return NextResponse.json({ error: 'No memberId' }, { status: 400 })

    const ok = await removeFamilyMember(memberId)
    return NextResponse.json({ ok })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Remove failed' },
      { status: 500 }
    )
  }
}
