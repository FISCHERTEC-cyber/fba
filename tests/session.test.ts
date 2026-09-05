import assert from 'node:assert/strict';
import test from 'node:test';
import { cookieValue, MAX_DEVICES, SESSION_LEASE_MS, tokenHash } from '../lib/session-security.ts';

test('session security limits remain explicit', () => {
  assert.equal(MAX_DEVICES, 5);
  assert.equal(SESSION_LEASE_MS, 15 * 60_000);
});

test('opaque tokens are stored as SHA-256 hashes', () => {
  assert.equal(tokenHash('secret').length, 64);
  assert.notEqual(tokenHash('secret'), 'secret');
});

test('cookie parser returns only the requested cookie', () => {
  const request = new Request('https://fba.example.test', { headers: { cookie: 'foo=bar; fba_session=abc%20123; other=x' } });
  assert.equal(cookieValue(request, 'fba_session'), 'abc 123');
});
