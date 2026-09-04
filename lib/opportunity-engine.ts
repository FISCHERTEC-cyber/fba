import type { Voucher, Opportunity } from './types';
import { redemptionScore } from './scoring';

export interface MerchantEvent {
  id: string;
  merchantName: string;
  title: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  distanceKm?: number;
  categories?: string[];
  detectedAt: string;
}

export interface OpportunityContext {
  now: string;
  preferredCategories?: string[];
  maxDistanceKm?: number;
}

export function buildOpportunities(
  vouchers: Voucher[],
  events: MerchantEvent[],
  context: OpportunityContext
): Opportunity[] {
  const now = new Date(context.now);
  const active = vouchers.filter(v => v.status === 'ACTIVE' && v.eventMonitoringEnabled);
  const opportunities: Opportunity[] = [];

  for (const voucher of active) {
    for (const event of events) {
      if (!sameMerchant(voucher.merchantName, event.merchantName)) continue;
      if (event.endsAt && new Date(event.endsAt) < now) continue;
      if (context.maxDistanceKm != null && event.distanceKm != null && event.distanceKm > context.maxDistanceKm) continue;

      const daysToExpiry = voucher.validUntil
        ? Math.ceil((new Date(voucher.validUntil).getTime() - now.getTime()) / 86400000)
        : undefined;
      const eventMatch = categoryMatch(event.categories ?? [], context.preferredCategories ?? []);
      const draftOpportunity: Partial<Opportunity> = {
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        sourceUrl: event.sourceUrl,
        distanceKm: event.distanceKm
      };
      const baseScore = redemptionScore(voucher, draftOpportunity, now);
      const score = Math.min(100, baseScore + (eventMatch ? 10 : 0));

      const reason = [`Passendes Event bei ${voucher.merchantName}`];
      if (daysToExpiry != null && daysToExpiry <= 30) reason.push(`Gutschein läuft in ${Math.max(daysToExpiry, 0)} Tagen ab`);
      if (event.distanceKm != null) reason.push(`${event.distanceKm.toFixed(1)} km entfernt`);
      if (eventMatch) reason.push('passt zu hinterlegten Interessen');

      opportunities.push({
        id: `${voucher.id}:${event.id}`,
        voucherId: voucher.id,
        merchantName: voucher.merchantName,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        sourceUrl: event.sourceUrl,
        distanceKm: event.distanceKm,
        relevanceScore: score,
        reason
      });
    }
  }

  return opportunities.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function sameMerchant(a: string, b: string) {
  return normaliseMerchant(a) === normaliseMerchant(b);
}

function normaliseMerchant(value: string) {
  return value.toLocaleLowerCase('de-DE').replace(/[^a-z0-9äöüß]/gi, '');
}

function categoryMatch(eventCategories: string[], preferred: string[]) {
  if (!preferred.length) return false;
  const p = new Set(preferred.map(x => x.toLocaleLowerCase('de-DE')));
  return eventCategories.some(x => p.has(x.toLocaleLowerCase('de-DE')));
}
