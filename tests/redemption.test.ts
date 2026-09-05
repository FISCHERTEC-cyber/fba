import assert from 'node:assert/strict';
import test from 'node:test';
import { decideRedemption } from '../lib/redemption.ts';

test('a partial redemption returns the exact remaining balance', () => {
  assert.deepEqual(decideRedemption({
    kind: 'VALUE', status: 'ACTIVE', valueAmount: 100, redeemedAmount: 27.45
  }, 12.55), { amount: 12.55, remainingAmount: 60, markRedeemed: false });
});

test('the final partial redemption closes the voucher', () => {
  assert.deepEqual(decideRedemption({
    kind: 'STORE_CREDIT', status: 'ACTIVE', valueAmount: 25, redeemedAmount: 20
  }, 5), { amount: 5, remainingAmount: 0, markRedeemed: true });
});

test('redemption cannot exceed the remaining balance', () => {
  assert.throws(() => decideRedemption({
    kind: 'VALUE', status: 'ACTIVE', valueAmount: 20, redeemedAmount: 5
  }, 15.01), /Restguthaben von 15.00 EUR/);
});

test('a service voucher is closed without a monetary transaction', () => {
  assert.deepEqual(decideRedemption({
    kind: 'SERVICE', status: 'ACTIVE', valueAmount: null, redeemedAmount: 0
  }, undefined, true), { amount: null, remainingAmount: null, markRedeemed: true });
});

test('inactive vouchers cannot be redeemed twice', () => {
  assert.throws(() => decideRedemption({
    kind: 'VALUE', status: 'REDEEMED', valueAmount: 10, redeemedAmount: 10
  }, undefined, true), /Nur aktive Vorteile/);
});
