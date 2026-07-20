import { NextRequest, NextResponse } from 'next/server'
import { chatWithAI } from '@/lib/ai/chat'

export async function POST(req: NextRequest) {
  try {
    const { message, history, image } = await req.json()
    if (!message) return NextResponse.json({ error: 'No message' }, { status: 400 })

    const result = await chatWithAI(message, history || [], image || undefined)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chat failed' },
      { status: 500 }
    )
  }
}
