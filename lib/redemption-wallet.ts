import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type CredentialSecretClass = 'CONFIDENTIAL' | 'RESTRICTED';

export function maskCredential(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Credential darf nicht leer sein.');
  if (trimmed.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(8, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

export function credentialFingerprint(value: string) {
  return createHash('sha256').update(value.trim()).digest('hex');
}

export function redactAuditDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditDetails);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    /(?:secret|credential|code|pin|barcode|qr|token|payload|encrypted)/i.test(key) ? '[REDACTED]' : redactAuditDetails(item)
  ]));
}

function encryptionKey() {
  const material = process.env.WALLET_CREDENTIAL_ENCRYPTION_KEY;
  if (!material) throw new Error('WALLET_CREDENTIAL_ENCRYPTION_KEY ist nicht konfiguriert.');
  return createHash('sha256').update(material).digest();
}

export function sealCredential(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value.trim(), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function openCredential(payload: string) {
  const [ivValue, tagValue, encryptedValue] = payload.split('.');
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('Ungültiges Credential-Format.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
}
