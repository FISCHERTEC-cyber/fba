import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpEmailDeliveryAdapter,
  nextDeliveryAttemptAt
} from '../lib/notification-delivery.ts';

test('email adapter sends provider-neutral payload and idempotency key', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = input.toString();
    requestInit = init;
    return new Response(JSON.stringify({ messageId: 'provider-123' }), { status: 202 });
  };
  const adapter = new HttpEmailDeliveryAdapter(
    'https://delivery.example.test/email',
    'secret-token',
    fakeFetch as typeof fetch
  );
  const result = await adapter.send({
    notificationId: 'notification-1',
    to: 'frank@example.test',
    subject: 'Gutschein läuft ab',
    text: 'Noch sieben Tage.'
  });

  assert.equal(requestUrl, 'https://delivery.example.test/email');
  assert.equal(new Headers(requestInit?.headers).get('idempotency-key'), 'notification-1');
  assert.equal(new Headers(requestInit?.headers).get('authorization'), 'Bearer secret-token');
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    notificationId: 'notification-1',
    to: 'frank@example.test',
    subject: 'Gutschein läuft ab',
    text: 'Noch sieben Tage.'
  });
  assert.equal(result.providerMessageId, 'provider-123');
});

test('delivery retries use capped exponential backoff', () => {
  const now = new Date('2026-09-04T20:00:00.000Z');
  assert.equal(nextDeliveryAttemptAt(1, now).toISOString(), '2026-09-04T20:15:00.000Z');
  assert.equal(nextDeliveryAttemptAt(2, now).toISOString(), '2026-09-04T20:30:00.000Z');
  assert.equal(nextDeliveryAttemptAt(20, now).toISOString(), '2026-09-05T20:00:00.000Z');
});
