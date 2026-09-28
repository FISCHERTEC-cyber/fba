import { Prisma, type CredentialKind, type CredentialSecretClass } from '@prisma/client';
import { prisma } from './prisma';
import { canRedeemFamilyVoucher } from './family-wallet-policy';
import { credentialFingerprint, maskCredential, openCredential, redactAuditDetails, sealCredential } from './redemption-wallet';

type Transaction = Prisma.TransactionClient;

async function accessibleVoucher(tx: Transaction, userId: string, voucherId: string) {
  return tx.voucher.findFirst({
    where: { id: voucherId, OR: [{ userId }, { wallet: { members: { some: { userId } } } }] },
    include: { wallet: { select: { members: { where: { userId }, select: { role: true } } } } }
  });
}

async function requireRedeemer(tx: Transaction, userId: string, voucherId: string) {
  const voucher = await accessibleVoucher(tx, userId, voucherId);
  const role = voucher?.userId === userId ? 'OWNER' : voucher?.wallet?.members[0]?.role;
  if (!voucher || !canRedeemFamilyVoucher(role)) throw new Error('Keine Berechtigung für dieses Credential.');
  return voucher;
}

export async function createVoucherCredential(input: {
  userId: string; voucherId: string; kind: CredentialKind; value: string; label?: string; secretClass?: CredentialSecretClass;
}) {
  if (!input.value.trim()) throw new Error('Credential darf nicht leer sein.');
  return prisma.$transaction(async tx => {
    const voucher = await requireRedeemer(tx, input.userId, input.voucherId);
    const credential = await tx.voucherCredential.create({ data: {
      voucherId: voucher.id, kind: input.kind, label: input.label?.trim() || null,
      secretClass: input.secretClass ?? 'CONFIDENTIAL', encryptedValue: sealCredential(input.value),
      valueFingerprint: credentialFingerprint(input.value), maskedValue: maskCredential(input.value)
    }, select: { id: true, kind: true, label: true, secretClass: true, maskedValue: true, createdAt: true } });
    await tx.benefitAuditEvent.create({ data: { voucherId: voucher.id, actorUserId: input.userId, action: 'CREDENTIAL_CREATED', details: redactAuditDetails({ kind: input.kind, secretClass: input.secretClass ?? 'CONFIDENTIAL' }) as Prisma.InputJsonValue } });
    return credential;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listVoucherCredentials(userId: string, voucherId: string) {
  return prisma.$transaction(async tx => {
    await requireRedeemer(tx, userId, voucherId);
    return tx.voucherCredential.findMany({ where: { voucherId, revokedAt: null }, select: { id: true, kind: true, label: true, secretClass: true, maskedValue: true, revealCount: true, lastRevealedAt: true, createdAt: true }, orderBy: { createdAt: 'asc' } });
  });
}

export async function revealVoucherCredential(userId: string, voucherId: string, credentialId: string) {
  return prisma.$transaction(async tx => {
    await requireRedeemer(tx, userId, voucherId);
    const credential = await tx.voucherCredential.findFirst({ where: { id: credentialId, voucherId, revokedAt: null } });
    if (!credential) throw new Error('Credential wurde nicht gefunden oder wurde widerrufen.');
    const now = new Date();
    await tx.voucherCredential.update({ where: { id: credential.id }, data: { revealCount: { increment: 1 }, lastRevealedAt: now } });
    await tx.benefitAuditEvent.create({ data: { voucherId, actorUserId: userId, action: 'CREDENTIAL_REVEALED', details: { credentialId: credential.id, kind: credential.kind } } });
    return { id: credential.id, value: openCredential(credential.encryptedValue), revealedAt: now };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function issueOfflineCredentialCache(input: { userId: string; deviceId: string; voucherId: string; credentialId: string; expiresInMinutes?: number }) {
  const minutes = input.expiresInMinutes ?? 240;
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1_440) throw new Error('Offline-Freigabe muss 5 bis 1440 Minuten gültig sein.');
  return prisma.$transaction(async tx => {
    await requireRedeemer(tx, input.userId, input.voucherId);
    const device = await tx.userDevice.findFirst({ where: { id: input.deviceId, userId: input.userId, revokedAt: null } });
    if (!device) throw new Error('Aktives Gerät wurde nicht gefunden.');
    const credential = await tx.voucherCredential.findFirst({ where: { id: input.credentialId, voucherId: input.voucherId, revokedAt: null } });
    if (!credential) throw new Error('Credential wurde nicht gefunden.');
    const expiresAt = new Date(Date.now() + minutes * 60_000);
    const payload = sealCredential(JSON.stringify({ voucherId: input.voucherId, credentialId: credential.id, value: openCredential(credential.encryptedValue), expiresAt: expiresAt.toISOString() }));
    const cache = await tx.offlineCredentialCache.upsert({
      where: { credentialId_deviceId: { credentialId: credential.id, deviceId: device.id } },
      create: { voucherId: input.voucherId, credentialId: credential.id, deviceId: device.id, encryptedPayload: payload, payloadHash: credentialFingerprint(payload), expiresAt },
      update: { encryptedPayload: payload, payloadHash: credentialFingerprint(payload), expiresAt, revokedAt: null }
    });
    await tx.benefitAuditEvent.create({ data: { voucherId: input.voucherId, actorUserId: input.userId, action: 'OFFLINE_CACHE_ISSUED', details: { credentialId: credential.id, deviceId: device.id, expiresAt } } });
    return { id: cache.id, expiresAt, deviceId: device.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function revokeOfflineCredentialCachesForDevice(tx: Transaction, deviceId: string, actorUserId?: string) {
  const caches = await tx.offlineCredentialCache.findMany({ where: { deviceId, revokedAt: null }, select: { id: true, voucherId: true } });
  if (!caches.length) return 0;
  const now = new Date();
  await tx.offlineCredentialCache.updateMany({ where: { id: { in: caches.map(cache => cache.id) } }, data: { revokedAt: now } });
  if (actorUserId) await tx.benefitAuditEvent.createMany({ data: caches.map(cache => ({ voucherId: cache.voucherId, actorUserId, action: 'OFFLINE_CACHE_REVOKED', details: { deviceId } })) });
  return caches.length;
}
