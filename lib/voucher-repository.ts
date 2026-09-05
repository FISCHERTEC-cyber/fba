import type { VoucherExtraction } from './extraction';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { decideRedemption } from './redemption';

export interface SaveReviewedVoucherInput {
  userId: string;
  extraction: VoucherExtraction;
  confirmedFields?: string[];
}

export async function saveReviewedVoucher(input: SaveReviewedVoucherInput) {
  const { userId, extraction } = input;
  if (!userId) throw new Error('userId fehlt.');

  const unresolvedLowConfidence = Object.entries(extraction.confidence.fields)
    .filter(([, confidence]) => confidence < 0.82)
    .map(([field]) => field)
    .filter(field => !(input.confirmedFields ?? []).includes(field));

  if (extraction.confidence.overall < 0.82 && !(input.confirmedFields ?? []).includes('_overall')) {
    unresolvedLowConfidence.unshift('_overall');
  }

  if (unresolvedLowConfidence.length) {
    throw new Error(`Nicht bestätigte unsichere Felder: ${unresolvedLowConfidence.join(', ')}`);
  }

  return prisma.voucher.create({
    data: {
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
    }
  });
}

export async function listActiveVouchers(userId: string) {
  const vouchers = await prisma.voucher.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { transactions: { orderBy: { createdAt: 'desc' } } },
    orderBy: [{ validUntil: 'asc' }, { createdAt: 'desc' }]
  });

  return vouchers.map(voucher => {
    const redeemedAmount = voucher.transactions.reduce(
      (sum, transaction) => sum + Number(transaction.amount ?? 0), 0
    );
    const remainingAmount = voucher.valueAmount === null
      ? null
      : Math.max(0, Math.round((Number(voucher.valueAmount) - redeemedAmount + Number.EPSILON) * 100) / 100);
    return { ...voucher, redeemedAmount, remainingAmount };
  });
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
      where: { id: input.voucherId, userId: input.userId },
      include: { transactions: true }
    });
    if (!voucher) throw new Error('Gutschein wurde nicht gefunden.');

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

    return { voucher: updatedVoucher, redemption, remainingAmount: decision.remainingAmount };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
