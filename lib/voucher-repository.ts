import { reviewFlags, type VoucherExtraction } from './extraction';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { decideRedemption } from './redemption';
import { canRedeemFamilyVoucher } from './family-wallet-policy';
import { emitLifecycleNotification } from './lifecycle-notifications';

export interface SaveReviewedVoucherInput {
  userId: string;
  extraction: VoucherExtraction;
  confirmedFields?: string[];
}

export function assertExtractionReviewed(extraction: VoucherExtraction, confirmedFields: string[] = []) {
  const unresolvedLowConfidence = reviewFlags(extraction)
    .map(({ field }) => field)
    .filter(field => !confirmedFields.includes(field));

  if (unresolvedLowConfidence.length) {
    throw new Error(`Nicht bestätigte unsichere Felder: ${unresolvedLowConfidence.join(', ')}`);
  }
}

export function reviewedVoucherData(userId: string, extraction: VoucherExtraction) {
  if (!userId) throw new Error('userId fehlt.');
  return {
    userId,
    merchantName: extraction.merchantName,
    title: extraction.title,
    kind: extraction.kind,
    valueAmount: extraction.valueAmount,
    currency: extraction.currency,
    discountPercent: extraction.discountPercent,
    code: extraction.code,
    barcode: extraction.barcode,
    qrPayload: extraction.qrPayload,
    validFrom: extraction.validFrom ? new Date(extraction.validFrom) : undefined,
    validUntil: extraction.validUntil ? new Date(extraction.validUntil) : undefined,
    minimumOrderValue: extraction.minimumOrderValue,
    redemptionUrl: extraction.redemptionUrl,
    terms: extraction.terms,
    physicalVoucher: extraction.physicalVoucher,
    storageLocation: extraction.storageLocation,
    lastLocationUpdate: extraction.storageLocation ? new Date() : undefined,
    eventMonitoringEnabled: extraction.eventMonitoringEnabled,
    extractionConfidence: extraction.confidence.overall,
    sourceType: extraction.sourceType,
    sourceReference: extraction.sourceReference
  };
}

export async function saveReviewedVoucher(input: SaveReviewedVoucherInput) {
  assertExtractionReviewed(input.extraction, input.confirmedFields);
  return prisma.voucher.create({ data: reviewedVoucherData(input.userId, input.extraction) });
}

export async function listActiveVouchers(userId: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const vouchers = await prisma.voucher.findMany({
    where: {
      status: 'ACTIVE',
      AND: [{ OR: [{ validUntil: null }, { validUntil: { gte: today } }] }],
      OR: [
        { userId },
        { wallet: { members: { some: { userId } } } }
      ]
    },
    include: {
      transactions: { orderBy: { createdAt: 'desc' } },
      wallet: {
        select: {
          id: true,
          name: true,
          members: { where: { userId }, select: { role: true } }
        }
      }
    },
    orderBy: [{ validUntil: 'asc' }, { createdAt: 'desc' }]
  });

  return vouchers.map(voucher => {
    const redeemedAmount = voucher.transactions.reduce(
      (sum, transaction) => sum + Number(transaction.amount ?? 0), 0
    );
    const remainingAmount = voucher.valueAmount === null
      ? null
      : Math.max(0, Math.round((Number(voucher.valueAmount) - redeemedAmount + Number.EPSILON) * 100) / 100);
    const owned = voucher.userId === userId;
    const accessRole = voucher.wallet?.members[0]?.role;
    return {
      ...voucher,
      redeemedAmount,
      remainingAmount,
      owned,
      accessRole: owned ? 'OWNER' : accessRole,
      canRedeem: owned || canRedeemFamilyVoucher(accessRole)
    };
  });
}

export async function listExpiredVouchers(userId: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return prisma.voucher.findMany({ where: { status: 'ACTIVE', validUntil: { lt: today }, OR: [{ userId }, { wallet: { members: { some: { userId } } } }] }, orderBy: [{ validUntil: 'desc' }] });
}

export interface RecordRedemptionInput {
  userId: string;
  voucherId: string;
  amount?: number;
  note?: string;
  receiptUrl?: string;
  redeemCompletely?: boolean;
}

export async function recordRedemption(input: RecordRedemptionInput) {
  if (!input.userId) throw new Error('userId fehlt.');
  if (!input.voucherId) throw new Error('voucherId fehlt.');

  return prisma.$transaction(async transaction => {
    const voucher = await transaction.voucher.findFirst({
      where: {
        id: input.voucherId,
        OR: [
          { userId: input.userId },
          { wallet: { members: { some: { userId: input.userId, role: { in: ['OWNER', 'MEMBER'] } } } } }
        ]
      },
      include: { transactions: true }
    });
    if (!voucher) throw new Error('Gutschein wurde nicht gefunden.');

    const now = new Date();
    await transaction.benefitReservation.updateMany({
      where: { voucherId: voucher.id, status: 'ACTIVE', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' }
    });
    const activeReservation = await transaction.benefitReservation.findFirst({
      where: { voucherId: voucher.id, status: 'ACTIVE', expiresAt: { gt: now } }
    });
    if (activeReservation && activeReservation.userId !== input.userId) {
      throw new Error('Der Gutschein ist derzeit von einem anderen Familienmitglied reserviert.');
    }
    const pendingTransfer = await transaction.benefitTransfer.findFirst({
      where: { voucherId: voucher.id, status: 'PENDING' }
    });
    if (pendingTransfer) throw new Error('Der Gutschein wird derzeit übertragen.');

    const redeemedAmount = voucher.transactions.reduce(
      (sum, redemption) => sum + Number(redemption.amount ?? 0), 0
    );
    const decision = decideRedemption({
      kind: voucher.kind,
      status: voucher.status,
      valueAmount: voucher.valueAmount === null ? null : Number(voucher.valueAmount),
      redeemedAmount
    }, input.amount, input.redeemCompletely);

    const redemption = await transaction.voucherTransaction.create({
      data: {
        voucherId: voucher.id,
        amount: decision.amount,
        note: input.note?.trim() || undefined,
        receiptUrl: input.receiptUrl?.trim() || undefined
      }
    });

    const updatedVoucher = decision.markRedeemed
      ? await transaction.voucher.update({ where: { id: voucher.id }, data: { status: 'REDEEMED' } })
      : voucher;

    await transaction.benefitAuditEvent.create({
      data: {
        voucherId: voucher.id,
        actorUserId: input.userId,
        action: 'REDEEMED',
        details: { amount: decision.amount, complete: decision.markRedeemed, redemptionId: redemption.id }
      }
    });

    return { voucher: updatedVoucher, redemption, remainingAmount: decision.remainingAmount };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function findAccessibleVoucher(voucherId: string, userId: string) {
  return prisma.voucher.findFirst({
    where: {
      id: voucherId,
      OR: [
        { userId },
        { wallet: { members: { some: { userId, role: { in: ['OWNER', 'MEMBER'] } } } } }
      ]
    }
  });
}

export async function reserveVoucher(userId: string, voucherId: string, expiresInMinutes = 30) {
  if (!Number.isInteger(expiresInMinutes) || expiresInMinutes < 5 || expiresInMinutes > 240) {
    throw new Error('Die Reservierungsdauer muss zwischen 5 und 240 Minuten liegen.');
  }

  return prisma.$transaction(async transaction => {
    const voucher = await transaction.voucher.findFirst({
      where: {
        id: voucherId,
        OR: [
          { userId },
          { wallet: { members: { some: { userId, role: { in: ['OWNER', 'MEMBER'] } } } } }
        ]
      }
    });
    if (!voucher || voucher.status !== 'ACTIVE') throw new Error('Gutschein ist nicht reservierbar.');
    const now = new Date();
    await transaction.benefitReservation.updateMany({
      where: { voucherId, status: 'ACTIVE', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' }
    });
    const activeReservation = await transaction.benefitReservation.findFirst({
      where: { voucherId, status: 'ACTIVE', expiresAt: { gt: now } }
    });
    if (activeReservation) {
      if (activeReservation.userId === userId) return activeReservation;
      throw new Error('Der Gutschein ist derzeit von einem anderen Familienmitglied reserviert.');
    }
    const pendingTransfer = await transaction.benefitTransfer.findFirst({ where: { voucherId, status: 'PENDING' } });
    if (pendingTransfer) throw new Error('Der Gutschein wird derzeit übertragen.');
    const reservation = await transaction.benefitReservation.create({
      data: { voucherId, userId, expiresAt: new Date(now.getTime() + expiresInMinutes * 60_000) }
    });
    await transaction.benefitAuditEvent.create({ data: { voucherId, actorUserId: userId, action: 'RESERVED', details: { expiresAt: reservation.expiresAt } } });
    await emitLifecycleNotification(transaction, {
      event: 'RESERVATION_CREATED', userId, voucherId, reservationId: reservation.id,
      merchantName: voucher.merchantName, expiresAt: reservation.expiresAt
    });
    return reservation;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function releaseVoucherReservation(userId: string, voucherId: string) {
  return prisma.$transaction(async transaction => {
    const reservation = await transaction.benefitReservation.findFirst({
      where: { voucherId, userId, status: 'ACTIVE' },
      include: { voucher: { select: { merchantName: true } } }
    });
    if (!reservation) throw new Error('Keine aktive eigene Reservierung vorhanden.');
    await transaction.benefitReservation.update({ where: { id: reservation.id }, data: { status: 'RELEASED' } });
    await transaction.benefitAuditEvent.create({ data: { voucherId, actorUserId: userId, action: 'RELEASED' } });
    await emitLifecycleNotification(transaction, {
      event: 'RESERVATION_RELEASED', userId, voucherId, reservationId: reservation.id,
      merchantName: reservation.voucher.merchantName
    });
  });
}

export async function startVoucherTransfer(senderUserId: string, voucherId: string, recipientUserId: string, expiresInHours = 72) {
  if (!recipientUserId || recipientUserId === senderUserId) throw new Error('Ein anderer Empfänger ist erforderlich.');
  if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 168) throw new Error('Die Übertragungsfrist muss zwischen 1 und 168 Stunden liegen.');
  return prisma.$transaction(async transaction => {
    const voucher = await transaction.voucher.findFirst({ where: { id: voucherId, userId: senderUserId } });
    if (!voucher || voucher.status !== 'ACTIVE') throw new Error('Gutschein ist nicht übertragbar.');
    const recipient = await transaction.user.findUnique({ where: { id: recipientUserId }, select: { id: true } });
    if (!recipient) throw new Error('Empfänger wurde nicht gefunden.');
    const activeReservation = await transaction.benefitReservation.findFirst({ where: { voucherId, status: 'ACTIVE', expiresAt: { gt: new Date() } } });
    if (activeReservation) throw new Error('Eine bestehende Reservierung muss zuerst freigegeben werden.');
    const existing = await transaction.benefitTransfer.findFirst({ where: { voucherId, status: 'PENDING' } });
    if (existing) throw new Error('Für diesen Gutschein läuft bereits eine Übertragung.');
    const transfer = await transaction.benefitTransfer.create({ data: { voucherId, senderUserId, recipientUserId, expiresAt: new Date(Date.now() + expiresInHours * 3_600_000) } });
    await transaction.benefitAuditEvent.create({ data: { voucherId, actorUserId: senderUserId, action: 'TRANSFER_STARTED', details: { transferId: transfer.id, recipientUserId, expiresAt: transfer.expiresAt } } });
    await emitLifecycleNotification(transaction, {
      event: 'TRANSFER_CREATED', userId: recipientUserId, voucherId, transferId: transfer.id,
      merchantName: voucher.merchantName, expiresAt: transfer.expiresAt
    });
    return transfer;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelVoucherTransfer(senderUserId: string, transferId: string) {
  return prisma.$transaction(async transaction => {
    const transfer = await transaction.benefitTransfer.findFirst({
      where: { id: transferId, senderUserId, status: 'PENDING' },
      include: { voucher: { select: { merchantName: true } } }
    });
    if (!transfer) throw new Error('Keine offene eigene Übertragung gefunden.');
    await transaction.benefitTransfer.update({ where: { id: transfer.id }, data: { status: 'CANCELLED' } });
    await transaction.benefitAuditEvent.create({ data: { voucherId: transfer.voucherId, actorUserId: senderUserId, action: 'TRANSFER_CANCELLED', details: { transferId } } });
    if (transfer.recipientUserId) {
      await emitLifecycleNotification(transaction, {
        event: 'TRANSFER_WITHDRAWN', userId: transfer.recipientUserId, voucherId: transfer.voucherId,
        transferId: transfer.id, merchantName: transfer.voucher.merchantName
      });
    }
  });
}

export async function acceptVoucherTransfer(recipientUserId: string, transferId: string) {
  return prisma.$transaction(async transaction => {
    const transfer = await transaction.benefitTransfer.findFirst({
      where: { id: transferId, recipientUserId, status: 'PENDING' },
      include: { voucher: { select: { merchantName: true } } }
    });
    if (!transfer) throw new Error('Keine offene Übertragung für diesen Nutzer gefunden.');
    if (transfer.expiresAt && transfer.expiresAt <= new Date()) throw new Error('Die Übertragung ist abgelaufen.');
    await transaction.voucher.update({ where: { id: transfer.voucherId }, data: { userId: recipientUserId, walletId: null } });
    const accepted = await transaction.benefitTransfer.update({ where: { id: transfer.id }, data: { status: 'ACCEPTED' } });
    await transaction.benefitAuditEvent.create({ data: { voucherId: transfer.voucherId, actorUserId: recipientUserId, action: 'TRANSFER_ACCEPTED', details: { transferId } } });
    await emitLifecycleNotification(transaction, {
      event: 'TRANSFER_ACCEPTED', userId: transfer.senderUserId, voucherId: transfer.voucherId,
      transferId: transfer.id, merchantName: transfer.voucher.merchantName
    });
    return accepted;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function declineVoucherTransfer(recipientUserId: string, transferId: string) {
  return prisma.$transaction(async transaction => {
    const transfer = await transaction.benefitTransfer.findFirst({
      where: { id: transferId, recipientUserId, status: 'PENDING' },
      include: { voucher: { select: { merchantName: true } } }
    });
    if (!transfer) throw new Error('Keine offene Übertragung für diesen Nutzer gefunden.');
    if (transfer.expiresAt && transfer.expiresAt <= new Date()) throw new Error('Die Übertragung ist abgelaufen.');
    await transaction.benefitTransfer.update({ where: { id: transfer.id }, data: { status: 'CANCELLED' } });
    await transaction.benefitAuditEvent.create({ data: { voucherId: transfer.voucherId, actorUserId: recipientUserId, action: 'TRANSFER_CANCELLED', details: { transferId, declined: true } } });
    await emitLifecycleNotification(transaction, {
      event: 'TRANSFER_DECLINED', userId: transfer.senderUserId, voucherId: transfer.voucherId,
      transferId: transfer.id, merchantName: transfer.voucher.merchantName
    });
  });
}

export async function listVoucherAudit(userId: string, voucherId: string) {
  const voucher = await findAccessibleVoucher(voucherId, userId);
  if (!voucher) throw new Error('Gutschein wurde nicht gefunden.');
  return prisma.benefitAuditEvent.findMany({ where: { voucherId }, include: { actor: { select: { id: true, email: true } } }, orderBy: { createdAt: 'desc' } });
}

export async function getVoucherDetail(userId: string, voucherId: string) {
  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, OR: [{ userId }, { wallet: { members: { some: { userId } } } }] },
    include: {
      wallet: { include: { members: { include: { user: { select: { id: true, email: true } } } } } },
      reservations: { where: { status: 'ACTIVE', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 1, include: { user: { select: { id: true, email: true } } } },
      transfers: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { id: true, email: true } }, recipient: { select: { id: true, email: true } } } },
      auditEvents: { orderBy: { createdAt: 'desc' }, take: 50, include: { actor: { select: { id: true, email: true } } } }
    }
  });
  if (!voucher) throw new Error('Gutschein wurde nicht gefunden.');
  const reservation = voucher.reservations[0] ?? null;
  const transfer = voucher.transfers[0] ?? null;
  const accessRole = voucher.userId === userId ? 'OWNER' : voucher.wallet?.members.find(member => member.userId === userId)?.role ?? 'VIEWER';
  return {
    ...voucher,
    reservation,
    transfer,
    accessRole,
    canReserve: accessRole !== 'VIEWER' && !transfer,
    canReleaseReservation: reservation?.userId === userId,
    canTransfer: voucher.userId === userId && !reservation && !transfer,
    canAcceptTransfer: transfer?.recipientUserId === userId,
    transferRecipients: voucher.wallet?.members.filter(member => member.userId !== userId).map(member => ({ id: member.user.id, label: member.user.email })) ?? []
  };
}
