import { NextRequest, NextResponse } from 'next/server'
import { setLibraryPassword, verifyLibraryPassword, removeLibraryPassword, hasLibraryPassword } from '@/lib/data/library'

export async function POST(req: NextRequest) {
  try {
    const { password, action } = await req.json()

    if (action === 'status') {
      const locked = await hasLibraryPassword()
      return NextResponse.json({ ok: true, locked })
    }

    if (action === 'set') {
      if (!password) return NextResponse.json({ error: 'No password' }, { status: 400 })
      const result = await setLibraryPassword(password)
      return NextResponse.json(result)
    }

    if (action === 'verify') {
      const ok = await verifyLibraryPassword(password || '')
      return NextResponse.json({ ok })
    }

    if (action === 'remove') {
      const ok = await removeLibraryPassword()
      return NextResponse.json({ ok })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Library password operation failed' },
      { status: 500 }
    )
  }
}
