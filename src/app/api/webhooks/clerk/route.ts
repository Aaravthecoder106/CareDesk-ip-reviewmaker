import { verifyWebhook } from '@clerk/nextjs/webhooks'
import type { NextRequest } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { provisionUser, deprovisionUser, fromUserJSON } from '@/lib/data/provisioning'

/**
 * Clerk webhook receiver — keeps public.users in sync with Clerk.
 *
 * Configure in the Clerk dashboard (Webhooks): endpoint `/api/webhooks/clerk`,
 * subscribed to `user.created`, `user.updated`, `user.deleted`. The signing
 * secret goes in CLERK_WEBHOOK_SIGNING_SECRET.
 *
 * verifyWebhook() authenticates the request via Standard Webhooks signatures;
 * an unsigned/forged request throws and yields 400 before any DB write. The
 * route is public (allow-listed in middleware) precisely because auth is the
 * signature, not a Clerk session.
 */
export async function POST(req: NextRequest) {
  let evt
  try {
    evt = await verifyWebhook(req)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  const admin = createAdminSupabaseClient()

  switch (evt.type) {
    case 'user.created':
    case 'user.updated': {
      const result = await provisionUser(admin, fromUserJSON(evt.data))
      if (!result.ok) {
        // Log detail server-side only; return a generic 500 so Clerk retries
        // with backoff without leaking internal schema/constraint text (M2).
        console.error(`[clerk webhook] provisioning failed: ${result.error}`)
        return new Response('provisioning failed', { status: 500 })
      }
      return new Response('ok', { status: 200 })
    }
    case 'user.deleted': {
      if (!evt.data.id) return new Response('ok', { status: 200 })
      const result = await deprovisionUser(admin, evt.data.id)
      if (!result.ok) {
        console.error(`[clerk webhook] deprovisioning failed: ${result.error}`)
        return new Response('deprovisioning failed', { status: 500 })
      }
      return new Response('ok', { status: 200 })
    }
    default:
      // Unhandled event types are acknowledged so Clerk stops retrying.
      return new Response('ignored', { status: 200 })
  }
}
