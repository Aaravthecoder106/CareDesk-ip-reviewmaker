import { NextRequest, NextResponse } from 'next/server'
import { getNotifications, markNotificationRead } from '@/lib/data/family'

export async function GET() {
  try {
    const notifications = await getNotifications()
    return NextResponse.json({ notifications })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 })
    const ok = await markNotificationRead(id)
    return NextResponse.json({ ok })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to mark read' },
      { status: 500 }
    )
  }
}
