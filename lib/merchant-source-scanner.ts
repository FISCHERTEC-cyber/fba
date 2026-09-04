import type { MerchantSource } from '@prisma/client';
import { parseStructuredEvents } from './event-source';
import { fetchMerchantSourceDocument } from './merchant-source-fetch';
import { reconcileMerchantSourceEvents, recordMerchantSourceCheck } from './merchant-source-repository';

export type MerchantSourceScanResult =
  | { sourceId: string; merchantName: string; status: 'NOT_MODIFIED' | 'UNCHANGED'; eventCount: 0 }
  | {
      sourceId: string;
      merchantName: string;
      status: 'RECONCILED';
      eventCount: number;
      added: number;
      updated: number;
      unchanged: number;
      reactivated: number;
      deactivated: number;
    }
  | { sourceId: string; merchantName: string; status: 'FAILED'; eventCount: 0; error: string };

export async function scanMerchantSource(
  source: Pick<MerchantSource, 'id' | 'merchantName' | 'url' | 'etag' | 'lastModified' | 'contentHash'>,
  now = new Date()
): Promise<MerchantSourceScanResult> {
  try {
    const document = await fetchMerchantSourceDocument({
      url: source.url,
      etag: source.etag,
      lastModified: source.lastModified
    });

    if (document.status === 'not-modified') {
      await recordMerchantSourceCheck(source.id, {
        success: true,
        etag: document.etag ?? source.etag ?? undefined,
        lastModified: document.lastModified ?? source.lastModified ?? undefined,
        contentHash: source.contentHash ?? undefined
      }, now);
      return { sourceId: source.id, merchantName: source.merchantName, status: 'NOT_MODIFIED', eventCount: 0 };
    }

    if (source.contentHash === document.contentHash) {
      await recordMerchantSourceCheck(source.id, {
        success: true,
        etag: document.etag,
        lastModified: document.lastModified,
        contentHash: document.contentHash
      }, now);
      return { sourceId: source.id, merchantName: source.merchantName, status: 'UNCHANGED', eventCount: 0 };
    }

    const events = parseStructuredEvents(document.html, {
      merchantName: source.merchantName,
      url: document.finalUrl,
      enabled: true
    }, now.toISOString());
    const summary = await reconcileMerchantSourceEvents(source.id, events, now);

    await recordMerchantSourceCheck(source.id, {
      success: true,
      etag: document.etag,
      lastModified: document.lastModified,
      contentHash: document.contentHash
    }, now);

    return {
      sourceId: source.id,
      merchantName: source.merchantName,
      status: 'RECONCILED',
      eventCount: events.length,
      ...summary
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    try {
      await recordMerchantSourceCheck(source.id, { success: false, error: message }, now);
    } catch {
      // The original scan failure remains the useful result when status persistence also fails.
    }
    return { sourceId: source.id, merchantName: source.merchantName, status: 'FAILED', eventCount: 0, error: message };
  }
}
