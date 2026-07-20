import { NextResponse } from 'next/server'
import { clearChatHistory } from '@/lib/data/chat'

export async function DELETE() {
  try {
    const ok = await clearChatHistory()
    return NextResponse.json({ ok })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Clear failed' },
      { status: 500 }
    )
  }
}
