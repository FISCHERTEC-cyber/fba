import { prisma } from './prisma';

export interface RegisterMerchantSourceInput {
  userId: string;
  merchantName: string;
  url: string;
  checkIntervalHours?: number;
}

export async function registerMerchantSource(input: RegisterMerchantSourceInput) {
  const url = new URL(input.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Nur HTTP/HTTPS-Quellen sind zulässig.');
  const interval = Math.max(1, Math.min(168, input.checkIntervalHours ?? 24));

  return prisma.merchantSource.upsert({
    where: { userId_url: { userId: input.userId, url: url.toString() } },
    create: {
      userId: input.userId,
      merchantName: input.merchantName.trim(),
      url: url.toString(),
      checkIntervalHours: interval
    },
    update: {
      merchantName: input.merchantName.trim(),
      enabled: true,
      checkIntervalHours: interval
    }
  });
}

export async function listDueMerchantSources(userId: string, now = new Date()) {
  const sources = await prisma.merchantSource.findMany({
    where: { userId, enabled: true },
    orderBy: { lastCheckedAt: 'asc' }
  });

  return sources.filter(source => {
    if (!source.lastCheckedAt) return true;
    const dueAt = source.lastCheckedAt.getTime() + source.checkIntervalHours * 3600000;
    return dueAt <= now.getTime();
  });
}

export async function recordMerchantSourceCheck(
  sourceId: string,
  result: { success: boolean; etag?: string; lastModified?: string; error?: string },
  now = new Date()
) {
  return prisma.merchantSource.update({
    where: { id: sourceId },
    data: result.success
      ? {
          lastCheckedAt: now,
          lastSuccessAt: now,
          failureCount: 0,
          lastError: null,
          etag: result.etag,
          lastModified: result.lastModified
        }
      : {
          lastCheckedAt: now,
          failureCount: { increment: 1 },
          lastError: result.error?.slice(0, 1000) ?? 'Unbekannter Fehler'
        }
  });
}
