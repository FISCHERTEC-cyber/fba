import assert from 'node:assert/strict';
import test from 'node:test';
import { assessRedemption } from '../lib/redemption-readiness.ts';

test('blocks redemption below a known minimum order value', () => {
  const result = assessRedemption({ minimumOrderValue: 30, allowedChannels: ['ONLINE'] }, { orderValue: 25, channel: 'ONLINE' });
  assert.equal(result.status, 'NOT_READY');
  assert.match(result.blockingReasons[0], /30.00/);
});

test('marks unverified conditions as conditionally ready without inventing eligibility', () => {
  const result = assessRedemption({ requiresMembership: true, combinationPolicy: 'CONDITIONAL' }, {});
  assert.equal(result.status, 'READY_WITH_WARNINGS');
  assert.equal(result.combinationPolicy, 'CONDITIONAL');
  assert.match(result.warnings[0], /Mitgliedschaft/);
});

test('requires a stored physical original when explicitly needed', () => {
  const result = assessRedemption({ requiresPhysicalVoucher: true }, { hasPhysicalVoucher: true, physicalVoucherAvailable: false });
  assert.equal(result.status, 'NOT_READY');
});
