import type { MerchantEvent } from './opportunity-engine';

export interface MerchantSource {
  merchantName: string;
  url: string;
  enabled: boolean;
}

export function parseStructuredEvents(html: string, source: MerchantSource, detectedAt = new Date().toISOString()): MerchantEvent[] {
  const events: MerchantEvent[] = [];
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  for (const match of scripts) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const json = JSON.parse(raw);
      for (const node of flattenJsonLd(json)) {
        if (!isEventNode(node)) continue;
        const title = asString(node.name);
        if (!title) continue;
        events.push({
          id: stableEventId(source.merchantName, title, asString(node.startDate)),
          merchantName: source.merchantName,
          title,
          description: asString(node.description),
          startsAt: asString(node.startDate),
          endsAt: asString(node.endDate),
          sourceUrl: asString(node.url) ?? source.url,
          sourceLabel: 'schema.org/Event',
          categories: inferCategories(`${title} ${asString(node.description) ?? ''}`),
          detectedAt
        });
      }
    } catch {
      // Invalid JSON-LD must not break scanning of the remaining page.
    }
  }

  return deduplicateEvents(events);
}

export function inferCategories(text: string): string[] {
  const rules: Array<[RegExp, string]> = [
    [/wild|reh|hirsch|wildschwein/i, 'wild'],
    [/gans|gänse|ente|enten/i, 'geflügel'],
    [/musik|konzert|live/i, 'musik'],
    [/wein|weinprobe/i, 'wein'],
    [/brunch|frühstück/i, 'brunch'],
    [/grill|bbq/i, 'grill'],
    [/spargel/i, 'spargel']
  ];
  return rules.filter(([pattern]) => pattern.test(text)).map(([, category]) => category);
}

function flattenJsonLd(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) return input.flatMap(flattenJsonLd);
  if (!input || typeof input !== 'object') return [];
  const obj = input as Record<string, unknown>;
  const graph = obj['@graph'];
  if (Array.isArray(graph)) return [obj, ...graph.flatMap(flattenJsonLd)];
  return [obj];
}

function isEventNode(node: Record<string, unknown>) {
  const type = node['@type'];
  return type === 'Event' || (Array.isArray(type) && type.includes('Event'));
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stableEventId(merchantName: string, title: string, startsAt?: string) {
  return `${merchantName}:${title}:${startsAt ?? ''}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function deduplicateEvents(events: MerchantEvent[]) {
  const byId = new Map<string, MerchantEvent>();
  for (const event of events) byId.set(event.id, event);
  return [...byId.values()];
}
