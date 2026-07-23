import 'server-only'
import { Resend } from 'resend'

const FEEDBACK_EMAIL = 'ay473671@gmail.com'

export interface FeedbackInput {
  wouldUse: string
  liked: string
  missing: string
  from: string
}

export async function sendFeedbackEmail(input: FeedbackInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'Resend not configured — set RESEND_API_KEY' }
  }

  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM_EMAIL || 'CareDesk <onboarding@resend.dev>'

  const { error } = await resend.emails.send({
    from,
    to: FEEDBACK_EMAIL,
    subject: `CareDesk feedback from ${input.from}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 520px;">
        <h2 style="margin: 0 0 16px;">💬 CareDesk Feedback</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 12px; background: #f4f4f5; font-weight: 600; border-radius: 6px 0 0 0;">From</td>
            <td style="padding: 8px 12px; background: #f4f4f5; border-radius: 0 6px 0 0;">${input.from}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #eee;">Would you use this app?</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${input.wouldUse}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #eee; vertical-align: top;">What did you like?</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${input.liked || '(empty)'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: 600; vertical-align: top;">What's missing?</td>
            <td style="padding: 8px 12px;">${input.missing || '(empty)'}</td>
          </tr>
        </table>
      </div>
    `,
    text: [
      `CareDesk Feedback from ${input.from}`,
      '',
      `Would you use this app? ${input.wouldUse}`,
      `What did you like? ${input.liked || '(empty)'}`,
      `What's missing? ${input.missing || '(empty)'}`,
      '',
      '---',
      'Sent from CareDesk feedback widget',
    ].join('\n'),
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
