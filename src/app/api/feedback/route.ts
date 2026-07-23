import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { sendViaResend } from '@/lib/email/family-invite'

const FEEDBACK_TO = 'ay473671@gmail.com'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { wouldUse, liked, missing } = await req.json()
    if (!wouldUse) return NextResponse.json({ error: 'Please answer the first question' }, { status: 400 })

    const user = await currentUser()
    const from = user?.emailAddresses?.[0]?.emailAddress || userId

    const subject = `CareDesk feedback from ${from}`
    const text = [
      `Feedback from: ${from}`,
      '',
      `Would you use this app? ${wouldUse}`,
      `What did you like? ${liked || '(empty)'}`,
      `What's missing? ${missing || '(empty)'}`,
    ].join('\n')

    const result = await sendViaResend(FEEDBACK_TO, subject, '', text)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Feedback failed' },
      { status: 500 }
    )
  }
}
