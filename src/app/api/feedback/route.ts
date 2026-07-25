import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { wouldUse, liked, missing } = await req.json()
    if (!wouldUse) return NextResponse.json({ error: 'Please answer the first question' }, { status: 400 })

    const user = await currentUser()
    const email = user?.emailAddresses?.[0]?.emailAddress || null

    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.from('feedback').insert({
      user_id: userId,
      email,
      would_use: wouldUse,
      liked: liked || null,
      missing: missing || null,
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

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}
