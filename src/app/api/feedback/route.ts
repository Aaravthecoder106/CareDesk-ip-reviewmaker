import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { Resend } from 'resend'

const FEEDBACK_EMAIL = 'ay473671@gmail.com'

function buildFeedbackEmailHtml(from: string, wouldUse: string, liked: string, missing: string): string {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 520px;">
      <h2 style="margin: 0 0 16px;">CareDesk Feedback</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 12px; background: #f4f4f5; font-weight: 600; width: 40%;">From</td>
          <td style="padding: 8px 12px;">${from}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f4f4f5; font-weight: 600;">Would you use this app?</td>
          <td style="padding: 8px 12px;">${wouldUse}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f4f4f5; font-weight: 600;">What did you like?</td>
          <td style="padding: 8px 12px;">${liked || '<em>(empty)</em>'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f4f4f5; font-weight: 600;">What's missing?</td>
          <td style="padding: 8px 12px;">${missing || '<em>(empty)</em>'}</td>
        </tr>
      </table>
      <p style="margin: 24px 0 0; font-size: 13px; color: #666;">Sent via CareDesk feedback widget</p>
    </div>
  `
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { wouldUse, liked, missing } = await req.json()
    if (!wouldUse) return NextResponse.json({ error: 'Please answer the first question' }, { status: 400 })

    const user = await currentUser()
    const from = user?.emailAddresses?.[0]?.emailAddress || userId

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 502 })
    }

    const resend = new Resend(apiKey)
    const subject = `CareDesk feedback from ${from}`
    const html = buildFeedbackEmailHtml(from, wouldUse, liked, missing)
    const text = [
      `Feedback from: ${from}`,
      '',
      `Would you use this app? ${wouldUse}`,
      `What did you like? ${liked || '(empty)'}`,
      `What's missing? ${missing || '(empty)'}`,
    ].join('\n')

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'CareDesk <onboarding@resend.dev>'
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: FEEDBACK_EMAIL,
      subject,
      html,
      text,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Feedback failed' },
      { status: 500 }
    )
  }
}
