export type LifecycleNotificationEvent =
  | 'RESERVATION_CREATED'
  | 'RESERVATION_RELEASED'
  | 'RESERVATION_EXPIRING'
  | 'RESERVATION_EXPIRED'
  | 'TRANSFER_CREATED'
  | 'TRANSFER_ACCEPTED'
  | 'TRANSFER_DECLINED'
  | 'TRANSFER_WITHDRAWN'
  | 'TRANSFER_EXPIRING';

export type NotificationEventFamily = 'RESERVATION' | 'TRANSFER' | 'PERMISSION' | 'CONFLICT' | 'FAMILY_COORDINATION';
export type NotificationPriority = 'INFORMATIONAL' | 'NORMAL' | 'TIME_SENSITIVE' | 'ACTION_BLOCKING';

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'code', 'pin', 'qrPayload', 'barcode', 'qr', 'voucherCode', 'securityCode'
]);

export function sanitizeNotificationPayload(input: Record<string, unknown> = {}) {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_PAYLOAD_KEYS.has(key)) continue;
    output[key] = value;
  }
  return output;
}

export function lifecycleNotificationDedupeKey(
  event: LifecycleNotificationEvent,
  entityId: string,
  userId: string
) {
  return `lifecycle:${event}:${entityId}:${userId}`;
}

export function lifecycleEventFamily(event: LifecycleNotificationEvent): NotificationEventFamily {
  return event.startsWith('RESERVATION_') ? 'RESERVATION' : 'TRANSFER';
}

export function lifecyclePriority(event: LifecycleNotificationEvent): NotificationPriority {
  if (event.endsWith('_EXPIRING')) return 'TIME_SENSITIVE';
  if (event.endsWith('_EXPIRED')) return 'INFORMATIONAL';
  return 'NORMAL';
}

export function lifecycleAllowsEmail(event: LifecycleNotificationEvent) {
  // Reservierungswarnungen sind kurzfristig und werden nie per E-Mail versendet.
  return !event.startsWith('RESERVATION_');
}

export function lifecycleNotificationText(
  event: LifecycleNotificationEvent,
  merchantName: string
): { title: string; body: string } {
  switch (event) {
    case 'RESERVATION_CREATED':
      return { title: 'Gutschein reserviert', body: `${merchantName}: Die Reservierung ist aktiv.` };
    case 'RESERVATION_RELEASED':
      return { title: 'Reservierung freigegeben', body: `${merchantName}: Der Gutschein ist wieder verfügbar.` };
    case 'RESERVATION_EXPIRING':
      return { title: 'Reservierung läuft bald ab', body: `${merchantName}: Prüfe die Reservierung, wenn du den Gutschein noch verwenden möchtest.` };
    case 'RESERVATION_EXPIRED':
      return { title: 'Reservierung abgelaufen', body: `${merchantName}: Der Gutschein ist wieder verfügbar.` };
    case 'TRANSFER_CREATED':
      return { title: 'Neue Gutscheinübertragung', body: `${merchantName}: Eine Übertragung wartet auf deine Entscheidung.` };
    case 'TRANSFER_ACCEPTED':
      return { title: 'Übertragung angenommen', body: `${merchantName}: Die Übertragung wurde angenommen.` };
    case 'TRANSFER_DECLINED':
      return { title: 'Übertragung abgelehnt', body: `${merchantName}: Die Übertragung wurde abgelehnt.` };
    case 'TRANSFER_WITHDRAWN':
      return { title: 'Übertragung zurückgezogen', body: `${merchantName}: Die Übertragung wurde zurückgezogen.` };
    case 'TRANSFER_EXPIRING':
      return { title: 'Übertragung läuft bald ab', body: `${merchantName}: Die offene Übertragung läuft bald ab.` };
  }
}

export function obsoleteLifecycleEventsFor(event: LifecycleNotificationEvent): LifecycleNotificationEvent[] {
  switch (event) {
    case 'RESERVATION_RELEASED':
    case 'RESERVATION_EXPIRED':
      return ['RESERVATION_EXPIRING'];
    case 'TRANSFER_ACCEPTED':
    case 'TRANSFER_DECLINED':
    case 'TRANSFER_WITHDRAWN':
      return ['TRANSFER_EXPIRING'];
    default:
      return [];
  }
}

export function shouldVerifyAfterMutationResult(result: 'SUCCESS' | 'DOMAIN_ERROR' | 'NETWORK_UNKNOWN') {
  return result === 'NETWORK_UNKNOWN';
}
