import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sendFeedbackEmail } from '@/lib/email/feedback'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { wouldUse, liked, missing } = await req.json()
    if (!wouldUse) return NextResponse.json({ error: 'Please answer the first question' }, { status: 400 })

    const user = await currentUser()
    const from = user?.emailAddresses?.[0]?.emailAddress || userId

    const result = await sendFeedbackEmail({ wouldUse, liked: liked || '', missing: missing || '', from })
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Feedback failed' },
      { status: 500 }
    )
  }
}
