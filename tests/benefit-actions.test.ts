import assert from 'node:assert/strict';
import test from 'node:test';
import { actionBucket, assertValidSnooze, isActionableForBadge } from '../lib/benefit-actions.ts';

const now = new Date('2026-09-13T12:00:00.000Z');

test('snooze after the technical expiry is rejected', () => {
  assert.throws(() => assertValidSnooze(new Date('2026-09-13T12:31:00.000Z'), new Date('2026-09-13T12:30:00.000Z'), now), /nicht nach dem Ablauf/);
});
test('a snoozed task is not counted in the badge before its resume time', () => {
  assert.equal(isActionableForBadge({ status: 'SNOOZED', snoozedUntil: new Date('2026-09-13T12:10:00.000Z') }, now), false);
  assert.equal(isActionableForBadge({ status: 'OPEN' }, now), true);
});
test('time critical actions are shown in the immediate work section', () => {
  assert.equal(actionBucket({ status: 'OPEN', priority: 'HIGH' }, now), 'NOW');
  assert.equal(actionBucket({ status: 'COMPLETED', priority: 'HIGH' }, now), 'DONE');
});
