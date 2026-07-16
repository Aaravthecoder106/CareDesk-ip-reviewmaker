import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fromUserJSON,
  fromUserResource,
  mapToUserRow,
} from '../src/lib/data/provisioning-map.ts'

// Minimal fixtures shaped like the Clerk payloads the real code receives.
// Only the fields provisioning reads are populated.

const webhookUser = {
  id: 'user_webhook_1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  primary_email_address_id: 'idn_primary',
  email_addresses: [
    { id: 'idn_other', email_address: 'other@example.com' },
    { id: 'idn_primary', email_address: 'ada@example.com' },
  ],
}

const resourceUser = {
  id: 'user_resource_1',
  firstName: 'Grace',
  lastName: 'Hopper',
  primaryEmailAddressId: 'idn_primary',
  emailAddresses: [
    { id: 'idn_primary', emailAddress: 'grace@example.com' },
    { id: 'idn_other', emailAddress: 'other@example.com' },
  ],
}

test('fromUserJSON resolves the primary email (snake_case)', () => {
  const n = fromUserJSON(webhookUser as never)
  assert.equal(n.id, 'user_webhook_1')
  assert.equal(n.email, 'ada@example.com')
  assert.equal(n.firstName, 'Ada')
  assert.equal(n.lastName, 'Lovelace')
})

test('fromUserResource resolves the primary email (camelCase)', () => {
  const n = fromUserResource(resourceUser as never)
  assert.equal(n.id, 'user_resource_1')
  assert.equal(n.email, 'grace@example.com')
  assert.equal(n.firstName, 'Grace')
  assert.equal(n.lastName, 'Hopper')
})

test('email falls back to first address when no primary id matches', () => {
  const n = fromUserJSON({
    ...webhookUser,
    primary_email_address_id: 'missing',
  } as never)
  assert.equal(n.email, 'other@example.com')
})

test('mapToUserRow builds a users insert row and omits role', () => {
  const row = mapToUserRow({
    id: 'u1',
    email: 'a@b.com',
    firstName: 'A',
    lastName: 'B',
  })
  assert.deepEqual(row, {
    id: 'u1',
    email: 'a@b.com',
    first_name: 'A',
    last_name: 'B',
  })
  // role must NOT be set here — it defaults server-side and is never
  // overwritten by a profile sync (privilege-escalation guard).
  assert.ok(row && !('role' in row))
})

test('mapToUserRow returns null when the user has no email', () => {
  const row = mapToUserRow({
    id: 'u2',
    email: null,
    firstName: null,
    lastName: null,
  })
  assert.equal(row, null)
})
