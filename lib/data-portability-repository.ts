import { Prisma, type DataExportFormat } from '@prisma/client';
import { prisma } from './prisma';
import { EXPORT_DOWNLOAD_TTL_MS, exportManifest, validateRestoreManifest, assertNoOwnedFamilyWallet, redactVoucherForExport, classifyRestoreCandidate } from './data-portability-policy';
import { newOpaqueToken, tokenHash } from './session-security';

export async function requestDataExport(input: { userId: string; format?: DataExportFormat; includeSensitiveData?: boolean; includeAuditData?: boolean; includeAttachments?: boolean }) {
  return prisma.dataExportRequest.create({ data: {
    userId: input.userId, format: input.format ?? 'JSON', includeSensitiveData: input.includeSensitiveData === true,
    includeAuditData: input.includeAuditData !== false, includeAttachments: input.includeAttachments === true
  } });
}

export async function completeDataExport(userId: string, exportId: string) {
  const request = await prisma.dataExportRequest.findFirst({ where: { id: exportId, userId, status: 'REQUESTED' } });
  if (!request) throw new Error('Export-Anfrage wurde nicht gefunden.');
  const vouchers = await prisma.voucher.findMany({ where: { userId }, include: { transactions: true, auditEvents: request.includeAuditData, credentials: request.includeSensitiveData ? { where: { revokedAt: null } } : false } });
  const payload = { vouchers: vouchers.map(voucher => redactVoucherForExport({ ...voucher, credentials: voucher.credentials?.map(credential => ({ kind: credential.kind, label: credential.label, secretClass: credential.secretClass, maskedValue: credential.maskedValue, encryptedValue: credential.encryptedValue, valueFingerprint: credential.valueFingerprint })) }, request.includeSensitiveData)) };
  const manifest = exportManifest({ format: request.format, includeSensitiveData: request.includeSensitiveData, payload });
  const token = newOpaqueToken(); const expiresAt = new Date(Date.now() + EXPORT_DOWNLOAD_TTL_MS);
  await prisma.dataExportRequest.update({ where: { id: request.id }, data: { status: 'READY', manifest: manifest as Prisma.InputJsonValue, payload: payload as Prisma.InputJsonValue, checksum: manifest.checksum, downloadTokenHash: tokenHash(token), downloadExpiresAt: expiresAt, completedAt: new Date() } });
  return { manifest, downloadToken: token, downloadExpiresAt: expiresAt };
}

export async function downloadDataExport(userId: string, token: string, now = new Date()) {
  const item = await prisma.dataExportRequest.findFirst({ where: { userId, downloadTokenHash: tokenHash(token), status: 'READY' } });
  if (!item || !item.downloadExpiresAt || item.downloadExpiresAt <= now || !item.payload || !item.manifest) throw new Error('Export ist nicht verfügbar oder der Download-Link ist abgelaufen.');
  return { manifest: item.manifest, payload: item.payload, format: item.format };
}

export async function expireDataExports(now = new Date()) {
  return prisma.dataExportRequest.updateMany({ where: { status: 'READY', downloadExpiresAt: { lte: now } }, data: { status: 'EXPIRED', payload: Prisma.JsonNull, downloadTokenHash: null } });
}

export async function createBackupProfile(input: { userId: string; name: string; format?: DataExportFormat; includeSensitiveData?: boolean; includeAuditData?: boolean; retentionDays?: number }) {
  const retentionDays = input.retentionDays ?? 30;
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw new Error('Aufbewahrungsdauer muss zwischen 1 und 3650 Tagen liegen.');
  return prisma.backupProfile.create({ data: { userId: input.userId, name: input.name.trim(), format: input.format ?? 'JSON', includeSensitiveData: input.includeSensitiveData === true, includeAuditData: input.includeAuditData !== false, retentionDays } });
}

export async function requestAccountDeletion(userId: string, now = new Date()) {
  const ownedWalletCount = await prisma.familyWalletMember.count({ where: { userId, role: 'OWNER' } });
  try { assertNoOwnedFamilyWallet(ownedWalletCount); }
  catch (error) { return prisma.accountDeletionRequest.create({ data: { userId, status: 'BLOCKED_BY_WALLET_OWNERSHIP', reason: error instanceof Error ? error.message : 'Wallet-Guard' } }); }
  return prisma.accountDeletionRequest.create({ data: { userId, status: 'SCHEDULED', executeAfter: new Date(now.getTime() + 30 * 24 * 60 * 60_000) } });
}

export function validateRestoreInput(input: { manifest: unknown; payload: unknown }) {
  const manifest = validateRestoreManifest(input.manifest);
  const checksum = exportManifest({ format: manifest.format, payload: input.payload, includeSensitiveData: false }).checksum;
  if (checksum !== manifest.checksum) throw new Error('Backup-Checksum stimmt nicht; Wiederherstellung wurde abgelehnt.');
  return manifest;
}

export async function previewRestore(userId: string, input: { manifest: unknown; payload: unknown }) {
  validateRestoreInput(input);
  const data = input.payload as { vouchers?: Array<{ merchantName?: string; title?: string }> };
  if (!Array.isArray(data.vouchers)) throw new Error('Backup enthält keine gültige Gutscheinliste.');
  const existing = await prisma.voucher.findMany({ where: { userId }, select: { merchantName: true, title: true } });
  return data.vouchers.map(voucher => ({ merchantName: voucher.merchantName, title: voucher.title, action: classifyRestoreCandidate(voucher, existing) }));
}
