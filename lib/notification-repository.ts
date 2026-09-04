import type { Prisma } from '@prisma/client';
import { buildOpportunities, type MerchantEvent } from './opportunity-engine';
import { prisma } from './prisma';
import {
  DEFAULT_REMINDER_TIME_ZONE,
  planExpiryNotifications,
  planOpportunityNotifications,
  type ExpiryVoucherCandidate,
  type OpportunityNotificationCandidate
} from './reminders';
import type { Voucher, VoucherKind, VoucherStatus } from './types';

export interface GenerateNotificationsOptions {
  now?: Date;
  timeZone?: string;
  minimumOpportunityScore?: number;
}

export async function generateDueNotifications(options: GenerateNotificationsOptions = {}) {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? DEFAULT_REMINDER_TIME_ZONE;
  const minimumScore = options.minimumOpportunityScore ?? 50;
  const expiryUpperBound = new Date(now.getTime() + 31 * 86_400_000);
  const expiryLowerBound = new Date(now.getTime() - 2 * 86_400_000);

  const [expiryRows, monitoredVoucherRows, eventRows] = await Promise.all([
    prisma.voucher.findMany({
      where: {
        status: 'ACTIVE',
        validUntil: { gte: expiryLowerBound, lte: expiryUpperBound }
      }
    }),
    prisma.voucher.findMany({
      where: { status: 'ACTIVE', eventMonitoringEnabled: true }
    }),
    prisma.merchantEvent.findMany({
      where: {
        active: true,
        source: { enabled: true },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }]
      },
      include: { source: { select: { userId: true } } }
    })
  ]);

  const expiryCandidates: ExpiryVoucherCandidate[] = expiryRows.map(voucher => ({
    id: voucher.id,
    userId: voucher.userId,
    merchantName: voucher.merchantName,
    title: voucher.title,
    validUntil: voucher.validUntil!,
    valueAmount: voucher.valueAmount == null ? undefined : Number(voucher.valueAmount),
    currency: voucher.currency ?? undefined,
    physicalVoucher: voucher.physicalVoucher,
    storageLocation: voucher.storageLocation ?? undefined
  }));
  const expiryDrafts = planExpiryNotifications(expiryCandidates, now, timeZone);

  const vouchersByUser = groupBy(monitoredVoucherRows.map(toVoucher), voucher => voucher.userId);
  const eventsByUser = groupBy(eventRows, event => event.source.userId);
  const opportunityCandidates: OpportunityNotificationCandidate[] = [];

  for (const [userId, userVouchers] of vouchersByUser) {
    const userEvents = eventsByUser.get(userId) ?? [];
    const events: MerchantEvent[] = userEvents.map(event => ({
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
    const opportunities = buildOpportunities(userVouchers.map(item => item.voucher), events, { now: now.toISOString() });
    for (const opportunity of opportunities) {
      const merchantEventId = opportunity.id.slice(opportunity.voucherId.length + 1);
      opportunityCandidates.push({ userId, merchantEventId, opportunity });
    }
  }

  const opportunityDrafts = planOpportunityNotifications(opportunityCandidates, now, minimumScore);
  const [expiryResult, opportunityResult] = await prisma.$transaction([
    prisma.notification.createMany({ data: asCreateManyInput(expiryDrafts), skipDuplicates: true }),
    prisma.notification.createMany({ data: asCreateManyInput(opportunityDrafts), skipDuplicates: true })
  ]);

  return {
    expiryCandidates: expiryDrafts.length,
    expiryCreated: expiryResult.count,
    opportunityCandidates: opportunityDrafts.length,
    opportunityCreated: opportunityResult.count
  };
}

function asCreateManyInput<T extends { payload: Record<string, unknown> }>(drafts: T[]) {
  return drafts.map(draft => ({ ...draft, payload: draft.payload as Prisma.InputJsonValue }));
}

export async function listNotifications(userId: string, options: { unreadOnly?: boolean; limit?: number } = {}) {
  const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 50)));
  return prisma.notification.findMany({
    where: {
      userId,
      dismissedAt: null,
      ...(options.unreadOnly ? { readAt: null } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

export function countUnreadNotifications(userId: string) {
  return prisma.notification.count({
    where: { userId, dismissedAt: null, readAt: null }
  });
}

export async function updateNotificationState(userId: string, id: string, action: 'READ' | 'DISMISS', now = new Date()) {
  const result = await prisma.notification.updateMany({
    where: { id, userId },
    data: action === 'READ' ? { readAt: now } : { dismissedAt: now }
  });
  if (!result.count) throw new Error('Benachrichtigung wurde nicht gefunden.');
}

function toVoucher(voucher: {
  id: string;
  userId: string;
  merchantName: string;
  title: string;
  kind: string;
  valueAmount: unknown;
  currency: string | null;
  discountPercent: unknown;
  code: string | null;
  validUntil: Date | null;
  minimumOrderValue: unknown;
  redemptionUrl: string | null;
  physicalVoucher: boolean;
  storageLocation: string | null;
  storageLocationPhotoUrl: string | null;
  status: string;
  eventMonitoringEnabled: boolean;
  extractionConfidence: number | null;
  createdAt: Date;
}) {
  const mapped: Voucher = {
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
  };
  return { userId: voucher.userId, voucher: mapped };
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const itemKey = key(item);
    grouped.set(itemKey, [...(grouped.get(itemKey) ?? []), item]);
  }
  return grouped;
}
