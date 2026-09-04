import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarDaysUntil,
  dueReminderDays,
  expandNotificationChannels,
  planExpiryNotifications,
  planOpportunityNotifications
} from '../lib/reminders.ts';

test('calendar reminder uses local dates across daylight-saving changes', () => {
  const now = new Date('2026-10-24T23:30:00.000Z');
  const expiry = new Date('2026-10-26T00:30:00.000Z');
  assert.equal(calendarDaysUntil(expiry, now, 'Europe/Berlin'), 1);
});

test('expiry reminder fires only on configured milestone days', () => {
  const now = new Date('2026-09-04T08:00:00.000Z');
  assert.equal(dueReminderDays('2026-09-11T21:59:00.000Z', now, 'Europe/Berlin'), 7);
  assert.equal(dueReminderDays('2026-09-12T21:59:00.000Z', now, 'Europe/Berlin'), null);
});

test('expiry notification includes value and physical storage location', () => {
  const now = new Date('2026-09-04T08:00:00.000Z');
  const drafts = planExpiryNotifications([{
    id: 'voucher-1',
    userId: 'user-1',
    merchantName: 'Gasthaus Adler',
    title: 'Restaurant-Gutschein',
    validUntil: '2026-09-11T21:59:00.000Z',
    valueAmount: 100,
    currency: 'EUR',
    physicalVoucher: true,
    storageLocation: 'Auto → Handschuhfach'
  }], now, 'Europe/Berlin');

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].dedupeKey, 'expiry:voucher-1:7:in-app');
  assert.match(drafts[0].body, /100,00\s€/);
  assert.match(drafts[0].body, /Auto → Handschuhfach/);
});

test('opportunity notifications respect minimum relevance score', () => {
  const base = {
    id: 'voucher-1:event-1',
    voucherId: 'voucher-1',
    merchantName: 'Gasthaus Adler',
    title: 'Wildwochen',
    relevanceScore: 49,
    reason: ['Gutschein vorhanden']
  };
  const low = planOpportunityNotifications([{ userId: 'user-1', merchantEventId: 'event-1', opportunity: base }]);
  const high = planOpportunityNotifications([{
    userId: 'user-1',
    merchantEventId: 'event-1',
    opportunity: { ...base, relevanceScore: 50 }
  }]);

  assert.equal(low.length, 0);
  assert.equal(high.length, 1);
  assert.equal(high[0].dedupeKey, 'opportunity:voucher-1:event-1:in-app');
});

test('email channel queues a separate notification for the user address', () => {
  const now = new Date('2026-09-04T08:00:00.000Z');
  const base = planExpiryNotifications([{
    id: 'voucher-1',
    userId: 'user-1',
    merchantName: 'Gasthaus Adler',
    title: 'Restaurant-Gutschein',
    validUntil: '2026-09-11T21:59:00.000Z',
    physicalVoucher: false
  }], now, 'Europe/Berlin');
  const drafts = expandNotificationChannels(
    base,
    ['IN_APP', 'EMAIL'],
    new Map([['user-1', 'frank@example.test']]),
    now
  );

  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].deliveryStatus, 'DELIVERED');
  assert.equal(drafts[1].channel, 'EMAIL');
  assert.equal(drafts[1].deliveryStatus, 'PENDING');
  assert.equal(drafts[1].recipient, 'frank@example.test');
  assert.equal(drafts[1].dedupeKey, 'expiry:voucher-1:7:email');
});
