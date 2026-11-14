import assert from 'node:assert/strict';
import test from 'node:test';
import { requireScanJobToken, requireInboundEmailToken, requireNotificationJobToken } from '../lib/job-auth.ts';

test('background jobs fail closed without configured secrets', () => {
  const original = process.env.SCAN_JOB_TOKEN;
  try {
    delete process.env.SCAN_JOB_TOKEN;
    assert.throws(
      () => requireScanJobToken(new Request('https://fba.example.test/api/jobs/merchant-source-scan')),
      /nicht konfiguriert/,
    );
  } finally {
    if (original === undefined) delete process.env.SCAN_JOB_TOKEN;
    else process.env.SCAN_JOB_TOKEN = original;
  }
});

test('background job endpoints reject absent, wrong, and malformed bearer values', () => {
  const old = process.env.NOTIFICATION_JOB_TOKEN;
  try {
    process.env.NOTIFICATION_JOB_TOKEN = 'ci-high-entropy-test-token-not-a-real-secret';
    const url = 'https://fba.example.test/api/jobs/notifications';
    for (const auth of ['', 'Bearer incorrect', 'Basic ci-high-entropy-test-token-not-a-real-secret']) {
      const headers = new Headers();
      if (auth) headers.set('authorization',auth);
      assert.throws(() => requireNotificationJobToken(new Request(url,{headers})),
        /Nicht autorisierter Aufruf/);
    }
    assert.doesNotThrow(() => requireNotificationJobToken(new Request(url,{
      headers:{authorization:'Bearer ci-high-entropy-test-token-not-a-real-secret'}
    })));
  } finally {
    if (old === undefined) delete process.env.NOTIFICATION_JOB_TOKEN;
    else process.env.NOTIFICATION_JOB_TOKEN = old;
  }
});

test('inbound email authorization rejects unauthorized webhook submissions before parsing', () => {
  const original = process.env.INBOUND_EMAIL_TOKEN;
  try {
    process.env.INBOUND_EMAIL_TOKEN = 'ci-test-token-for-webhook';
    assert.throws(
      () => requireInboundEmailToken(new Request('https://fba.example.test/api/inbound/email',{
        method:'POST',body:'{"bad":"payload"}'
      })),
      /Nicht autorisierter Aufruf/,
    );
  } finally {
    if (original === undefined) delete process.env.INBOUND_EMAIL_TOKEN;
    else process.env.INBOUND_EMAIL_TOKEN = original;
  }
});
