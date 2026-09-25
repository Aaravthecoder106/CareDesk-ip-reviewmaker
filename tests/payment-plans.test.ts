import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getPlanRank,
  isPaidTier,
  isPaymentAmountValid,
  isPlanTier,
  PLANS,
} from '../src/lib/plans.ts'

test('keeps existing paid plan IDs', () => {
  assert.deepEqual(Object.keys(PLANS), [
    'free',
    'pro_individual_monthly',
    'pro_individual_annual',
    'family_monthly',
    'family_annual',
  ])
})

test('uses exact Indian pricing', () => {
  assert.equal(PLANS.pro_individual_monthly.priceInPaise, 29900)
  assert.equal(PLANS.pro_individual_monthly.equivalentMonthlyInr, 299)
  assert.equal(PLANS.pro_individual_annual.priceInPaise, 249900)
  assert.equal(PLANS.pro_individual_annual.equivalentMonthlyInr, 208)
  assert.equal(PLANS.family_monthly.priceInPaise, 69900)
  assert.equal(PLANS.family_monthly.equivalentMonthlyInr, 699)
  assert.equal(PLANS.family_annual.priceInPaise, 549900)
  assert.equal(PLANS.family_annual.equivalentMonthlyInr, 458)
})

test('accepts only exact server order and payment amounts', () => {
  assert.equal(isPaymentAmountValid('pro_individual_monthly', 29900, 29900), true)
  assert.equal(isPaymentAmountValid('pro_individual_annual', 249900, 249900), true)
  assert.equal(isPaymentAmountValid('family_monthly', 69900, 69900), true)
  assert.equal(isPaymentAmountValid('family_annual', 549900, 549900), true)
  assert.equal(isPaymentAmountValid('pro_individual_monthly', 29900, 1), false)
  assert.equal(isPaymentAmountValid('pro_individual_monthly', 1, 29900), false)
  assert.equal(isPaymentAmountValid('free', 0, 0), false)
})

test('classifies plan IDs and upgrade order', () => {
  assert.equal(isPlanTier('family_annual'), true)
  assert.equal(isPlanTier('legacy_pro'), false)
  assert.equal(isPaidTier('free'), false)
  assert.equal(isPaidTier('pro_individual_annual'), true)
  assert.equal(getPlanRank('free'), 0)
  assert.equal(getPlanRank('pro_individual_monthly'), 1)
  assert.equal(getPlanRank('family_annual'), 2)
})
