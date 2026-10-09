import test from 'node:test'
import assert from 'node:assert/strict'

const envKeys = [
  'NODE_ENV',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SIGNING_SECRET',
  'GEMINI_API_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'RAZORPAY_PLAN_PRO_INDIVIDUAL_MONTHLY',
  'RAZORPAY_PLAN_PRO_INDIVIDUAL_ANNUAL',
  'RAZORPAY_PLAN_FAMILY_MONTHLY',
  'RAZORPAY_PLAN_FAMILY_ANNUAL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
]

test('local environment uses safe placeholder defaults instead of failing validation', async () => {
  const original = { ...process.env }

  try {
    for (const key of envKeys) {
      delete process.env[key]
    }

    // NODE_ENV is declared readonly by Next's types; write through a cast.
    ;(process.env as { NODE_ENV?: string }).NODE_ENV = 'development'

    const mod = await import('../src/env.ts')

    assert.equal(mod.env.SUPABASE_SERVICE_ROLE_KEY, 'placeholder')
    assert.equal(mod.env.CLERK_SECRET_KEY, 'placeholder')
    assert.equal(mod.env.NEXT_PUBLIC_SUPABASE_URL, 'https://placeholder.supabase.co')
    assert.equal(mod.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'placeholder')
    assert.equal(mod.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'pk_placeholder')
  } finally {
    process.env = original
  }
})
