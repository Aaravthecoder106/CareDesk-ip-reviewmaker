import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { currentUser } from '@clerk/nextjs/server'
import { resolveAppUrl } from '@/lib/email/family-invite'

const FEEDBACK_EMAIL = 'ay473671@gmail.com'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { wouldUse, liked, missing } = await req.json()
    if (!wouldUse) return NextResponse.json({ error: 'Please answer the first question' }, { status: 400 })

    const user = await currentUser()
    const from = user?.emailAddresses?.[0]?.emailAddress || userId

    // FormSubmit relays the submission to the email inbox; no API key needed.
    // We must provide User-Agent and Origin/Referer because FormSubmit blocks pure server-to-server
    // calls that look like local HTML files (which is the error the user sees).
    // Use the real deployment URL so FormSubmit doesn't reject the request.
    const appUrl = resolveAppUrl(req.headers.get('origin'))

    const res = await fetch(`https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': appUrl,
        'Referer': `${appUrl}/`
      },
      body: JSON.stringify({
        _subject: `CareDesk feedback from ${from}`,
        _template: 'table',
        'Would you use this app?': wouldUse,
        'What did you like?': liked || '(empty)',
        "What's missing?": missing || '(empty)',
        'From user': from,
      }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok || data?.success === 'false' || data?.success === false) {
      return NextResponse.json(
        { error: data?.message || 'Email service rejected the feedback' },
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
