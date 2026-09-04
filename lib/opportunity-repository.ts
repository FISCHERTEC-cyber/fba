import { prisma } from './prisma';
import { buildOpportunities } from './opportunity-engine';
import type { Voucher, VoucherKind, VoucherStatus } from './types';

export interface StoredOpportunityQuery {
  now?: Date;
  preferredCategories?: string[];
  maxDistanceKm?: number;
}

export async function buildStoredOpportunities(userId: string, query: StoredOpportunityQuery = {}) {
  const now = query.now ?? new Date();
  const [storedVouchers, storedEvents] = await Promise.all([
    prisma.voucher.findMany({
      where: { userId, status: 'ACTIVE', eventMonitoringEnabled: true }
    }),
    prisma.merchantEvent.findMany({
      where: {
        active: true,
        source: { userId, enabled: true },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }]
      }
    })
  ]);

  const vouchers: Voucher[] = storedVouchers.map(voucher => ({
    id: voucher.id,
    merchantName: voucher.merchantName,
    title: voucher.title,
    kind: voucher.kind as VoucherKind,
    valueAmount: voucher.valueAmount == null ? undefined : Number(voucher.valueAmount),
    currency: voucher.currency ?? undefined,
    discountPercent: voucher.discountPercent == null ? undefined : Number(voucher.discountPercent),
    code: voucher.code ?? undefined,
    validUntil: voucher.validUntil?.toISOString(),
    minimumOrderValue: voucher.minimumOrderValue == null ? undefined : Number(voucher.minimumOrderValue),
    redemptionUrl: voucher.redemptionUrl ?? undefined,
    physicalVoucher: voucher.physicalVoucher,
    storageLocation: voucher.storageLocation ?? undefined,
    storageLocationPhotoUrl: voucher.storageLocationPhotoUrl ?? undefined,
    status: voucher.status as VoucherStatus,
    eventMonitoringEnabled: voucher.eventMonitoringEnabled,
    extractionConfidence: voucher.extractionConfidence ?? undefined,
    createdAt: voucher.createdAt.toISOString()
  }));

  const events = storedEvents.map(event => ({
    id: event.id,
    merchantName: event.merchantName,
    title: event.title,
    description: event.description ?? undefined,
    startsAt: event.startsAt?.toISOString(),
    endsAt: event.endsAt?.toISOString(),
    sourceUrl: event.sourceUrl ?? undefined,
    sourceLabel: event.sourceLabel ?? undefined,
    categories: event.categories,
    detectedAt: event.lastDetectedAt.toISOString()
  }));

  return buildOpportunities(vouchers, events, {
    now: now.toISOString(),
    preferredCategories: query.preferredCategories,
    maxDistanceKm: query.maxDistanceKm
  });
}
