import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideLifecycleDelivery,
  lifecycleAllowsEmail,
  lifecycleNotificationDedupeKey,
  lifecycleNotificationText,
  obsoleteLifecycleEventsFor,
  sanitizeNotificationPayload,
  shouldVerifyAfterMutationResult
} from '../lib/notification-governance.ts';

test('kurzfristige Reservierungswarnungen werden nie per E-Mail versendet', () => {
  assert.equal(lifecycleAllowsEmail('RESERVATION_EXPIRING'), false);
  assert.equal(lifecycleAllowsEmail('RESERVATION_EXPIRED'), false);
  assert.equal(lifecycleAllowsEmail('TRANSFER_EXPIRING'), true);
});

test('sensible Gutscheinwerte werden aus Notification-Payloads entfernt', () => {
  assert.deepEqual(sanitizeNotificationPayload({
    voucherId: 'v1', code: 'SECRET', pin: '1234', qrPayload: 'qr', barcode: 'bar', transferId: 't1'
  }), { voucherId: 'v1', transferId: 't1' });
});

test('Lifecycle-Deduplizierung ist semantisch und kanalbezogen stabil', () => {
  assert.equal(
    lifecycleNotificationDedupeKey('TRANSFER_CREATED', 't1', 'u2'),
    lifecycleNotificationDedupeKey('TRANSFER_CREATED', 't1', 'u2')
  );
  assert.notEqual(
    lifecycleNotificationDedupeKey('TRANSFER_CREATED', 't1', 'u2'),
    lifecycleNotificationDedupeKey('TRANSFER_ACCEPTED', 't1', 'u2')
  );
  assert.notEqual(
    lifecycleNotificationDedupeKey('TRANSFER_CREATED', 't1', 'u2', 'IN_APP'),
    lifecycleNotificationDedupeKey('TRANSFER_CREATED', 't1', 'u2', 'EMAIL')
  );
});

test('abschließende Lifecycle-Ereignisse superseden Ablaufwarnungen', () => {
  assert.deepEqual(obsoleteLifecycleEventsFor('TRANSFER_ACCEPTED'), ['TRANSFER_EXPIRING']);
  assert.deepEqual(obsoleteLifecycleEventsFor('TRANSFER_DECLINED'), ['TRANSFER_EXPIRING']);
  assert.deepEqual(obsoleteLifecycleEventsFor('TRANSFER_WITHDRAWN'), ['TRANSFER_EXPIRING']);
  assert.deepEqual(obsoleteLifecycleEventsFor('RESERVATION_RELEASED'), ['RESERVATION_EXPIRING']);
  assert.deepEqual(obsoleteLifecycleEventsFor('RESERVATION_EXPIRED'), ['RESERVATION_EXPIRING']);
});

test('unsicheres Netzwerkresultat erzwingt Zustandsprüfung statt zweiter Mutation', () => {
  assert.equal(shouldVerifyAfterMutationResult('NETWORK_UNKNOWN'), true);
  assert.equal(shouldVerifyAfterMutationResult('SUCCESS'), false);
});

test('Lifecycle-Texte enthalten keine Codes oder PINs', () => {
  const text = lifecycleNotificationText('TRANSFER_CREATED', 'IKEA');
  assert.match(text.body, /IKEA/);
  assert.doesNotMatch(`${text.title} ${text.body}`, /code|pin|qr|barcode/i);
});

test('Quiet Hours unterdrücken externe Transfer-Kanäle, In-App bleibt erhalten', () => {
  const decision = decideLifecycleDelivery('TRANSFER_CREATED', {
    emailEnabled: true,
    pushEnabled: true,
    quietHoursStart: 22 * 60,
    quietHoursEnd: 7 * 60,
    timeZone: 'Europe/Berlin'
  }, new Date('2026-09-13T21:30:00Z'));
  assert.deepEqual(decision.channels, ['IN_APP']);
  assert.deepEqual(decision.suppressed.map(item => item.reason), ['QUIET_HOURS', 'QUIET_HOURS']);
});

test('Transfer-E-Mail kann außerhalb der Ruhezeit freigegeben werden', () => {
  const decision = decideLifecycleDelivery('TRANSFER_CREATED', {
    emailEnabled: true,
    quietHoursStart: 22 * 60,
    quietHoursEnd: 7 * 60,
    timeZone: 'Europe/Berlin'
  }, new Date('2026-09-13T12:00:00Z'));
  assert.deepEqual(decision.channels, ['IN_APP', 'EMAIL']);
});
