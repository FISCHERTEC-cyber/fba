import assert from 'node:assert/strict';
import test from 'node:test';
import { emailImportSource, inboundEmailSchema } from '../lib/inbound-email.ts';

test('email subject and text become one traceable import source', () => {
  const email = inboundEmailSchema.parse({
    messageId: 'mail-42',
    from: 'shop@example.org',
    to: 'frank@example.org',
    subject: 'Ihr Gutschein über 50 EUR',
    text: 'Code: FBA-2026'
  });
  assert.deepEqual(emailImportSource(email), {
    sourceType: 'EMAIL',
    mimeType: 'text/plain',
    rawText: 'Ihr Gutschein über 50 EUR\nCode: FBA-2026',
    sourceReference: 'mail-42'
  });
});

test('an attachment is used when the email has no text', () => {
  const email = inboundEmailSchema.parse({
    messageId: 'mail-43', from: 'shop@example.org', to: 'frank@example.org',
    attachments: [{ fileName: 'voucher.pdf', mimeType: 'application/pdf', base64Data: 'YWJj' }]
  });
  assert.equal(emailImportSource(email).fileName, 'voucher.pdf');
  assert.equal(emailImportSource(email).sourceType, 'EMAIL');
});

test('empty inbound email is rejected', () => {
  assert.throws(() => inboundEmailSchema.parse({
    messageId: 'mail-44', from: 'shop@example.org', to: 'frank@example.org'
  }));
});
