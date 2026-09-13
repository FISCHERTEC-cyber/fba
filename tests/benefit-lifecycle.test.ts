import assert from 'node:assert/strict';
import test from 'node:test';
import { canStartRedemption, transitionBenefit } from '../lib/benefit-lifecycle.ts';

test('a reservation prevents another family member from redeeming', () => {
  assert.equal(canStartRedemption('RESERVED', false), false);
  assert.equal(canStartRedemption('RESERVED', true), true);
});
test('transfer pending cannot be redeemed or reserved', () => {
  assert.throws(() => transitionBenefit('TRANSFER_PENDING', 'REDEEM'), /nicht zulässig/);
  assert.equal(transitionBenefit('TRANSFER_PENDING', 'CANCEL_TRANSFER'), 'ACTIVE');
});
test('redeemed benefits are only archivable', () => {
  assert.throws(() => transitionBenefit('REDEEMED', 'START_TRANSFER'), /nicht zulässig/);
  assert.equal(transitionBenefit('REDEEMED', 'ARCHIVE'), 'ARCHIVED');
});
