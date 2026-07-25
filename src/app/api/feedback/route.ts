import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { wouldUse, liked, missing } = await req.json()
    if (!wouldUse) return NextResponse.json({ error: 'Please answer the first question' }, { status: 400 })

    const user = await currentUser()
    const email = user?.emailAddresses?.[0]?.emailAddress || null

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 502 })
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        email,
        would_use: wouldUse,
        liked: liked || null,
        missing: missing || null,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => 'Unknown error')
      return NextResponse.json({ error: errBody }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Feedback failed' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 502 })
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback?order=created_at.desc`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
    })

    if (res.status === 404) {
      // Table doesn't exist yet - tell user to apply migration
      return NextResponse.json({ 
        error: 'Feedback table not found. Run the migration SQL in Supabase dashboard.',
        data: [] 
      }, { status: 200 })
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => 'Unknown error')
      return NextResponse.json({ error: errBody }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}