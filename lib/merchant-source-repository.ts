import type { MerchantEvent } from './opportunity-engine';
import { planEventReconciliation } from './event-reconciliation';
import { normaliseMerchantSourceUrl } from './merchant-source-fetch';
import { prisma } from './prisma';

export interface RegisterMerchantSourceInput {
  userId: string;
  merchantName: string;
  url: string;
  checkIntervalHours?: number;
}

export async function registerMerchantSource(input: RegisterMerchantSourceInput) {
  const url = normaliseMerchantSourceUrl(input.url);
  const interval = Math.max(1, Math.min(168, input.checkIntervalHours ?? 24));

  return prisma.merchantSource.upsert({
    where: { userId_url: { userId: input.userId, url } },
    create: {
      userId: input.userId,
      merchantName: input.merchantName.trim(),
      url,
      checkIntervalHours: interval
    },
    update: {
      merchantName: input.merchantName.trim(),
      enabled: true,
      checkIntervalHours: interval,
      nextCheckAt: new Date()
    }
  });
}

export async function listDueMerchantSources(userId: string, now = new Date()) {
  return prisma.merchantSource.findMany({
    where: { userId, enabled: true, nextCheckAt: { lte: now } },
    orderBy: { nextCheckAt: 'asc' }
  });
}

export async function listDueMerchantSourcesForScan(limit = 20, now = new Date()) {
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  return prisma.merchantSource.findMany({
    where: { enabled: true, nextCheckAt: { lte: now } },
    orderBy: [{ nextCheckAt: 'asc' }, { createdAt: 'asc' }],
    take: safeLimit
  });
}

export async function recordMerchantSourceCheck(
  sourceId: string,
  result: {
    success: boolean;
    etag?: string;
    lastModified?: string;
    contentHash?: string;
    error?: string;
  },
  now = new Date()
) {
  const source = await prisma.merchantSource.findUnique({
    where: { id: sourceId },
    select: { checkIntervalHours: true, failureCount: true }
  });
  if (!source) throw new Error('Händlerquelle wurde nicht gefunden.');
  const retryHours = result.success
    ? source.checkIntervalHours
    : Math.min(source.checkIntervalHours, 2 ** Math.min(source.failureCount, 6));
  const nextCheckAt = new Date(now.getTime() + retryHours * 3_600_000);

  return prisma.merchantSource.update({
    where: { id: sourceId },
    data: result.success
      ? {
          lastCheckedAt: now,
          lastSuccessAt: now,
          nextCheckAt,
          failureCount: 0,
          lastError: null,
          etag: result.etag,
          lastModified: result.lastModified,
          contentHash: result.contentHash
        }
      : {
          lastCheckedAt: now,
          nextCheckAt,
          failureCount: { increment: 1 },
          lastError: result.error?.slice(0, 1000) ?? 'Unbekannter Fehler'
        }
  });
}

export async function reconcileMerchantSourceEvents(
  sourceId: string,
  events: MerchantEvent[],
  detectedAt = new Date()
) {
  return prisma.$transaction(async transaction => {
    const existing = await transaction.merchantEvent.findMany({
      where: { sourceId },
      select: { id: true, externalKey: true, fingerprint: true, active: true, missingCount: true }
    });
    const plan = planEventReconciliation(existing, events);

    for (const item of plan.upserts) {
      const event = item.event;
      const startsAt = validDate(event.startsAt);
      const endsAt = validDate(event.endsAt);
      await transaction.merchantEvent.upsert({
        where: { sourceId_externalKey: { sourceId, externalKey: event.id } },
        create: {
          sourceId,
          externalKey: event.id,
          merchantName: event.merchantName,
          title: event.title,
          description: event.description,
          startsAt,
          endsAt,
          sourceUrl: event.sourceUrl,
          sourceLabel: event.sourceLabel,
          categories: event.categories ?? [],
          fingerprint: item.fingerprint,
          active: true,
          missingCount: 0,
          firstDetectedAt: detectedAt,
          lastDetectedAt: detectedAt,
          lastChangedAt: detectedAt
        },
        update: {
          merchantName: event.merchantName,
          title: event.title,
          description: event.description,
          startsAt,
          endsAt,
          sourceUrl: event.sourceUrl,
          sourceLabel: event.sourceLabel,
          categories: event.categories ?? [],
          fingerprint: item.fingerprint,
          active: true,
          missingCount: 0,
          lastDetectedAt: detectedAt,
          ...(item.changed || item.reactivated ? { lastChangedAt: detectedAt } : {})
        }
      });
    }

    for (const item of plan.missing) {
      await transaction.merchantEvent.update({
        where: { id: item.id },
        data: {
          missingCount: item.missingCount,
          ...(item.deactivate ? { active: false, lastChangedAt: detectedAt } : {})
        }
      });
    }

    return plan.summary;
  });
}

function validDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
