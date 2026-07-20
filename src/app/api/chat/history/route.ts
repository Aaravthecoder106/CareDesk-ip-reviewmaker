import { NextResponse } from 'next/server'
import { getChatHistory } from '@/lib/data/chat'

export async function GET() {
  try {
    const messages = await getChatHistory()
    return NextResponse.json({ messages })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch history' },
      { status: 500 }
    )
  }
}
