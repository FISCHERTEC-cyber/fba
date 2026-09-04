import type { VoucherExtraction } from './extraction';
import { prisma } from './prisma';

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
  return prisma.voucher.findMany({
    where: { userId, status: 'ACTIVE' },
    orderBy: [{ validUntil: 'asc' }, { createdAt: 'desc' }]
  });
}
