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
export type LifecycleDeliveryChannel = 'IN_APP' | 'EMAIL' | 'PUSH';

export interface LifecycleNotificationPreference {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  timeZone?: string | null;
}

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
  userId: string,
  channel: LifecycleDeliveryChannel = 'IN_APP'
) {
  return `lifecycle:${event}:${entityId}:${userId}:${channel}`;
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
  // Reservierungsereignisse sind kurzfristig bzw. in der App unmittelbar sichtbar.
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

export function decideLifecycleDelivery(
  event: LifecycleNotificationEvent,
  preference: LifecycleNotificationPreference | null | undefined,
  now = new Date()
) {
  // Lifecycle-Zustände bleiben mindestens in-app sichtbar, damit das Produkt keine
  // fachlich relevante Zustandsinformation durch eine Kanalpräferenz verliert.
  const channels: LifecycleDeliveryChannel[] = ['IN_APP'];
  const suppressed: Array<{ channel: LifecycleDeliveryChannel; reason: string }> = [];
  const quiet = isWithinQuietHours(now, preference?.timeZone ?? 'Europe/Berlin', preference?.quietHoursStart, preference?.quietHoursEnd);

  if (preference?.emailEnabled && lifecycleAllowsEmail(event)) {
    if (quiet) suppressed.push({ channel: 'EMAIL', reason: 'QUIET_HOURS' });
    else channels.push('EMAIL');
  } else if (preference?.emailEnabled && !lifecycleAllowsEmail(event)) {
    suppressed.push({ channel: 'EMAIL', reason: 'EVENT_NOT_EMAIL_ELIGIBLE' });
  }

  // Push ist fachlich entscheidbar, aber wird erst erzeugt, wenn ein Push-Transport
  // vorhanden ist. Dadurch wird keine Zustellung vorgetäuscht.
  if (preference?.pushEnabled) {
    if (quiet) suppressed.push({ channel: 'PUSH', reason: 'QUIET_HOURS' });
    else suppressed.push({ channel: 'PUSH', reason: 'PUSH_TRANSPORT_UNAVAILABLE' });
  }

  return { channels, suppressed, priority: lifecyclePriority(event) };
}

export function isWithinQuietHours(
  now: Date,
  timeZone: string,
  startMinutes?: number | null,
  endMinutes?: number | null
) {
  if (startMinutes == null || endMinutes == null || startMinutes === endMinutes) return false;
  const current = localMinutes(now, timeZone);
  return startMinutes < endMinutes
    ? current >= startMinutes && current < endMinutes
    : current >= startMinutes || current < endMinutes;
}

function localMinutes(now: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(now);
    const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

export function shouldVerifyAfterMutationResult(result: 'SUCCESS' | 'DOMAIN_ERROR' | 'NETWORK_UNKNOWN') {
  return result === 'NETWORK_UNKNOWN';
}
