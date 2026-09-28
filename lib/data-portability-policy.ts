import { createHash } from 'node:crypto';

export const EXPORT_SCHEMA_VERSION = '1.0';
export const EXPORT_DOWNLOAD_TTL_MS = 24 * 60 * 60_000;

export function exportManifest(input: { format: string; includeSensitiveData?: boolean; payload: unknown; generatedAt?: Date }) {
  const generatedAt = input.generatedAt ?? new Date();
  const canonical = JSON.stringify(input.payload);
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    format: input.format,
    sensitiveDataIncluded: input.includeSensitiveData === true,
    checksum: createHash('sha256').update(canonical).digest('hex')
  };
}

export function validateRestoreManifest(value: unknown) {
  const item = value as { schemaVersion?: string; checksum?: string; format?: string };
  if (!item || item.schemaVersion !== EXPORT_SCHEMA_VERSION || !item.checksum || !item.format) throw new Error('Backup-Manifest ist ungültig oder nicht kompatibel.');
  return item as Required<typeof item>;
}

export function assertNoOwnedFamilyWallet(ownedWalletCount: number) {
  if (ownedWalletCount > 0) throw new Error('Kontolöschung ist blockiert: Eigentum an einer Family Wallet muss zuvor übertragen oder beendet werden.');
}

export function redactVoucherForExport(voucher: Record<string, unknown>, includeSensitiveData: boolean) {
  const { code, barcode, qrPayload, credentials, ...safe } = voucher;
  if (includeSensitiveData) return { ...safe, code, barcode, qrPayload, credentials };
  return { ...safe, credentials: Array.isArray(credentials) ? credentials.map(item => {
    const credential = item as Record<string, unknown>;
    const { encryptedValue, valueFingerprint, ...masked } = credential;
    return masked;
  }) : undefined };
}

export function classifyRestoreCandidate(candidate: { merchantName?: string; title?: string }, existing: Array<{ merchantName: string; title: string }>) {
  const duplicate = existing.some(item => item.merchantName.trim().toLowerCase() === candidate.merchantName?.trim().toLowerCase() && item.title.trim().toLowerCase() === candidate.title?.trim().toLowerCase());
  return duplicate ? 'DUPLICATE_REVIEW_REQUIRED' : 'CREATE_REVIEW_REQUIRED';
}
