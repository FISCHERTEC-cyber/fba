import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicIpAddress, normaliseMerchantSourceUrl } from '../lib/merchant-source-fetch.ts';
import { eventFingerprint, planEventReconciliation } from '../lib/event-reconciliation.ts';
import type { MerchantEvent } from '../lib/opportunity-engine.ts';

function merchantEvent(overrides: Partial<MerchantEvent> = {}): MerchantEvent {
  return {
    id: 'gasthaus-adler-wildwochen-2026-10-10',
    merchantName: 'Gasthaus Adler',
    title: 'Wildwochen',
    startsAt: '2026-10-10T00:00:00.000Z',
    categories: ['Wild'],
    detectedAt: '2026-09-04T18:00:00.000Z',
    ...overrides
  };
}

test('merchant source URLs reject local and credential-bearing targets', () => {
  assert.throws(() => normaliseMerchantSourceUrl('http://localhost/events'), /Lokale oder interne/);
  assert.throws(() => normaliseMerchantSourceUrl('http://192.168.1.1/events'), /Private oder reservierte/);
  assert.throws(() => normaliseMerchantSourceUrl('https://user:secret@example.org/events'), /Zugangsdaten/);
  assert.equal(normaliseMerchantSourceUrl('https://Example.org/events#today'), 'https://example.org/events');
});

test('IP filter distinguishes public from private and reserved addresses', () => {
  assert.equal(isPublicIpAddress('8.8.8.8'), true);
  assert.equal(isPublicIpAddress('10.0.0.1'), false);
  assert.equal(isPublicIpAddress('169.254.169.254'), false);
  assert.equal(isPublicIpAddress('::1'), false);
  assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true);
});

test('event fingerprint is stable when category order changes', () => {
  const first = eventFingerprint(merchantEvent({ categories: ['Wild', 'Saisonküche'] }));
  const second = eventFingerprint(merchantEvent({ categories: ['saisonküche', 'wild'] }));
  assert.equal(first, second);
});

test('reconciliation adds, updates and waits for a second miss before deactivation', () => {
  const changedEvent = merchantEvent({ title: 'Wildwochen 2026' });
  const unchangedEvent = merchantEvent({ id: 'music', title: 'Musikabend', categories: ['Musik'] });
  const observed = [changedEvent, unchangedEvent, merchantEvent({ id: 'new', title: 'Gänsewochen' })];
  const existing = [
    { id: 'db-1', externalKey: changedEvent.id, fingerprint: 'old', active: true, missingCount: 0 },
    { id: 'db-2', externalKey: unchangedEvent.id, fingerprint: eventFingerprint(unchangedEvent), active: true, missingCount: 0 },
    { id: 'db-3', externalKey: 'missing-once', fingerprint: 'x', active: true, missingCount: 0 },
    { id: 'db-4', externalKey: 'missing-twice', fingerprint: 'y', active: true, missingCount: 1 }
  ];

  const plan = planEventReconciliation(existing, observed);
  assert.deepEqual(plan.summary, { added: 1, updated: 1, unchanged: 1, reactivated: 0, deactivated: 1 });
  assert.deepEqual(plan.missing, [
    { id: 'db-3', missingCount: 1, deactivate: false },
    { id: 'db-4', missingCount: 2, deactivate: true }
  ]);
});

test('reconciliation reactivates a returning event', () => {
  const event = merchantEvent();
  const plan = planEventReconciliation([
    { id: 'db-1', externalKey: event.id, fingerprint: eventFingerprint(event), active: false, missingCount: 3 }
  ], [event]);
  assert.equal(plan.summary.reactivated, 1);
  assert.equal(plan.upserts[0].reactivated, true);
});
