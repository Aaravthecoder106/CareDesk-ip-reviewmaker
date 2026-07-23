import 'server-only'
import { Resend } from 'resend'

export function resolveAppUrl(origin?: string | null): string {
  if (origin) return origin.replace(/\/$/, '')
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function buildInviteEmailContent(params: {
  token: string
  inviterName: string
  relation?: string
  appUrl: string
}) {
  const { token, inviterName, relation, appUrl } = params
  const familyUrl = `${appUrl}/dashboard/family`
  const signUpUrl = `${appUrl}/sign-up`
  const relationLine = relation ? ` as your ${relation}` : ''

  const subject = `${inviterName} invited you to join their CareDesk family`

  const text = [
    `${inviterName} invited you to join CareDesk${relationLine}.`,
    '',
    'Your invite code:',
    token,
    '',
    'How to accept:',
    `1. Create an account or sign in at ${signUpUrl}`,
    `2. Open the Family page: ${familyUrl}`,
    '3. Paste the invite code above and tap Accept Invite',
    '',
    'CareDesk helps families share health insights securely.',
  ].join('\n')

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 520px;">
      <h2 style="margin: 0 0 12px;">You're invited to CareDesk</h2>
      <p style="margin: 0 0 16px;">
        <strong>${inviterName}</strong> invited you to join their family on CareDesk${relationLine}.
      </p>
      <p style="margin: 0 0 8px; font-size: 14px; color: #555;">Your invite code:</p>
      <div style="background: #f4f4f5; border-radius: 8px; padding: 14px 16px; font-family: monospace; font-size: 13px; word-break: break-all; margin-bottom: 20px;">
        ${token}
      </div>
      <p style="margin: 0 0 8px;"><strong>How to accept</strong></p>
      <ol style="margin: 0 0 20px; padding-left: 20px;">
        <li><a href="${signUpUrl}">Create an account</a> or sign in to CareDesk</li>
        <li>Open the <a href="${familyUrl}">Family page</a></li>
        <li>Paste the invite code and tap <strong>Accept Invite</strong></li>
      </ol>
      <p style="margin: 0; font-size: 13px; color: #666;">
        CareDesk helps families share health insights securely.
      </p>
    </div>
  `

  return { subject, text, html }
}

export async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'Resend not configured' }

  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM_EMAIL || 'CareDesk <onboarding@resend.dev>'

  const { error } = await resend.emails.send({ from, to, subject, html, text })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

async function sendViaFormSubmit(
  to: string,
  subject: string,
  inviterName: string,
  token: string,
  appUrl: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const familyUrl = `${appUrl}/dashboard/family`
  const signUpUrl = `${appUrl}/sign-up`

  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; CareDesk/1.0)',
      Origin: appUrl,
      Referer: `${appUrl}/`,
    },
    body: JSON.stringify({
      _subject: subject,
      _template: 'table',
      'Invited by': inviterName,
      'Invite code': token,
      'Sign up': signUpUrl,
      'Family page': familyUrl,
      Instructions:
        'Create an account, open the Family page, paste the invite code, and tap Accept Invite.',
    }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok || data?.success === 'false' || data?.success === false) {
    return { ok: false, error: data?.message || 'Email delivery failed' }
  }
  return { ok: true }
}

export async function sendFamilyInviteEmail(params: {
  to: string
  token: string
  inviterName: string
  relation?: string
  appUrl: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { to, token, inviterName, relation, appUrl } = params
  const { subject, text, html } = buildInviteEmailContent({
    token,
    inviterName,
    relation,
    appUrl,
  })

  const formResult = await sendViaFormSubmit(to, subject, inviterName, token, appUrl)
  if (formResult.ok) return formResult

  const resendResult = await sendViaResend(to, subject, html, text)
  if (resendResult.ok) return resendResult

  return {
    ok: false,
    error: formResult.error || resendResult.error || 'Could not send invite email',
  }
}
