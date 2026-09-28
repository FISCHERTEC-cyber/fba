import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNoOwnedFamilyWallet, exportManifest, validateRestoreManifest } from '../lib/data-portability-policy.ts';

test('exports are versioned, checksummed and keep sensitive data opt-in', () => {
  const manifest = exportManifest({ format: 'JSON', payload: { vouchers: [] }, generatedAt: new Date('2026-09-28T10:00:00Z') });
  assert.equal(manifest.schemaVersion, '1.0'); assert.equal(manifest.sensitiveDataIncluded, false); assert.equal(manifest.checksum.length, 64);
  assert.equal(validateRestoreManifest(manifest).format, 'JSON');
});

test('account deletion is blocked while the user owns a family wallet', () => {
  assert.throws(() => assertNoOwnedFamilyWallet(1), /Kontolöschung ist blockiert/);
  assert.doesNotThrow(() => assertNoOwnedFamilyWallet(0));
});
