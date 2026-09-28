import assert from 'node:assert/strict';
import test from 'node:test';
import { credentialFingerprint, maskCredential, redactAuditDetails } from '../lib/redemption-wallet.ts';

test('wallet credentials are consistently masked and fingerprinted', () => {
  assert.equal(maskCredential('ABCDEF1234'), '••••••1234');
  assert.equal(maskCredential('1234'), '••••');
  assert.equal(credentialFingerprint(' ABCD '), credentialFingerprint('ABCD'));
});

test('audit payloads never retain secret-shaped fields', () => {
  assert.deepEqual(redactAuditDetails({ credential: 'x', code: 'x', amount: 12, nested: { pin: '1234', label: 'Kasse' } }), {
    credential: '[REDACTED]', code: '[REDACTED]', amount: 12, nested: { pin: '[REDACTED]', label: 'Kasse' }
  });
});
