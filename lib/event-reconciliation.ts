import { createHash } from 'node:crypto';
import type { MerchantEvent } from './opportunity-engine';

export interface ExistingMerchantEvent {
  id: string;
  externalKey: string;
  fingerprint: string;
  active: boolean;
  missingCount: number;
}

export interface EventUpsertPlan {
  event: MerchantEvent;
  fingerprint: string;
  isNew: boolean;
  changed: boolean;
  reactivated: boolean;
}

export interface MissingEventPlan {
  id: string;
  missingCount: number;
  deactivate: boolean;
}

export interface EventReconciliationPlan {
  upserts: EventUpsertPlan[];
  missing: MissingEventPlan[];
  summary: {
    added: number;
    updated: number;
    unchanged: number;
    reactivated: number;
    deactivated: number;
  };
}

export function planEventReconciliation(
  existing: ExistingMerchantEvent[],
  observed: MerchantEvent[],
  missingThreshold = 2
): EventReconciliationPlan {
  const threshold = Math.max(1, missingThreshold);
  const byKey = new Map(existing.map(event => [event.externalKey, event]));
  const observedKeys = new Set<string>();
  const upserts = observed.map(event => {
    observedKeys.add(event.id);
    const previous = byKey.get(event.id);
    const fingerprint = eventFingerprint(event);
    return {
      event,
      fingerprint,
      isNew: !previous,
      changed: !previous || previous.fingerprint !== fingerprint,
      reactivated: Boolean(previous && !previous.active)
    };
  });

  const missing = existing
    .filter(event => !observedKeys.has(event.externalKey))
    .map(event => {
      const missingCount = event.missingCount + 1;
      return { id: event.id, missingCount, deactivate: event.active && missingCount >= threshold };
    });

  return {
    upserts,
    missing,
    summary: {
      added: upserts.filter(item => item.isNew).length,
      updated: upserts.filter(item => !item.isNew && item.changed).length,
      unchanged: upserts.filter(item => !item.changed).length,
      reactivated: upserts.filter(item => item.reactivated).length,
      deactivated: missing.filter(item => item.deactivate).length
    }
  };
}

export function eventFingerprint(event: MerchantEvent): string {
  const canonical = JSON.stringify({
    merchantName: event.merchantName.trim(),
    title: event.title.trim(),
    description: event.description?.trim() ?? null,
    startsAt: event.startsAt ?? null,
    endsAt: event.endsAt ?? null,
    sourceUrl: event.sourceUrl ?? null,
    categories: [...(event.categories ?? [])].map(value => value.toLocaleLowerCase('de-DE')).sort()
  });
  return createHash('sha256').update(canonical).digest('hex');
}
