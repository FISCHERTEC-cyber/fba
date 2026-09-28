import { Prisma, type DataExportFormat } from '@prisma/client';
import { prisma } from './prisma';
import { EXPORT_DOWNLOAD_TTL_MS, exportManifest, validateRestoreManifest, assertNoOwnedFamilyWallet } from './data-portability-policy';
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
  const payload = { vouchers: vouchers.map(voucher => ({ ...voucher, credentials: request.includeSensitiveData ? voucher.credentials?.map(credential => ({ kind: credential.kind, label: credential.label, secretClass: credential.secretClass, maskedValue: credential.maskedValue })) : undefined })) };
  const manifest = exportManifest({ format: request.format, includeSensitiveData: request.includeSensitiveData, payload });
  const token = newOpaqueToken(); const expiresAt = new Date(Date.now() + EXPORT_DOWNLOAD_TTL_MS);
  await prisma.dataExportRequest.update({ where: { id: request.id }, data: { status: 'READY', manifest: manifest as Prisma.InputJsonValue, checksum: manifest.checksum, downloadTokenHash: tokenHash(token), downloadExpiresAt: expiresAt, completedAt: new Date() } });
  return { manifest, downloadToken: token, downloadExpiresAt: expiresAt };
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
