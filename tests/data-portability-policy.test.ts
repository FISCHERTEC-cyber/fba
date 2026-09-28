import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNoOwnedFamilyWallet, classifyRestoreCandidate, exportManifest, redactVoucherForExport, validateRestoreManifest } from '../lib/data-portability-policy.ts';

test('exports are versioned, checksummed and keep sensitive data opt-in', () => {
  const manifest = exportManifest({ format: 'JSON', payload: { vouchers: [] }, generatedAt: new Date('2026-09-28T10:00:00Z') });
  assert.equal(manifest.schemaVersion, '1.0'); assert.equal(manifest.sensitiveDataIncluded, false); assert.equal(manifest.checksum.length, 64);
  assert.equal(validateRestoreManifest(manifest).format, 'JSON');
});

test('default exports omit voucher secrets and restore never silently overwrites', () => {
  const safe = redactVoucherForExport({ merchantName: 'A', title: 'B', code: 'secret', barcode: 'secret', credentials: [{ maskedValue: '••••1234', encryptedValue: 'cipher', valueFingerprint: 'hash' }] }, false) as Record<string, unknown>;
  assert.equal('code' in safe, false); assert.equal('barcode' in safe, false);
  assert.equal(classifyRestoreCandidate({ merchantName: 'A', title: 'B' }, [{ merchantName: 'A', title: 'B' }]), 'DUPLICATE_REVIEW_REQUIRED');
  assert.equal(classifyRestoreCandidate({ merchantName: 'A', title: 'C' }, [{ merchantName: 'A', title: 'B' }]), 'CREATE_REVIEW_REQUIRED');
});

test('account deletion is blocked while the user owns a family wallet', () => {
  assert.throws(() => assertNoOwnedFamilyWallet(1), /Kontolöschung ist blockiert/);
  assert.doesNotThrow(() => assertNoOwnedFamilyWallet(0));
});
