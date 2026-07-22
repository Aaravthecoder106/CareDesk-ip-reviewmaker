import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { createFamilyInvite } from '@/lib/data/family'
import { resolveAppUrl, sendFamilyInviteEmail } from '@/lib/email/family-invite'

export async function POST(req: NextRequest) {
  try {
    const { email, relation } = await req.json()
    if (!email) return NextResponse.json({ error: 'No email' }, { status: 400 })

    const result = await createFamilyInvite(email, relation)
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    const user = await currentUser()
    const inviterName =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
      user?.emailAddresses?.[0]?.emailAddress ||
      'A CareDesk user'

    const appUrl = resolveAppUrl(req.headers.get('origin'))
    const emailResult = await sendFamilyInviteEmail({
      to: email.trim(),
      token: result.token,
      inviterName,
      relation,
      appUrl,
    })

    if (!emailResult.ok) {
      return NextResponse.json({
        ok: true,
        emailSent: false,
        token: result.token,
        error: `Invite created, but email could not be sent: ${emailResult.error}. Copy the code from Pending Invites.`,
      })
    }

    return NextResponse.json({ ok: true, emailSent: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invite failed' },
      { status: 500 }
    )
  }
}
