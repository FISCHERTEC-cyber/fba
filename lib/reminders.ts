import type { Opportunity } from './types';

export const DEFAULT_REMINDER_DAYS = [30, 14, 7, 2, 0] as const;
export const DEFAULT_REMINDER_TIME_ZONE = 'Europe/Berlin';

export interface ExpiryVoucherCandidate {
  id: string;
  userId: string;
  merchantName: string;
  title: string;
  validUntil: string | Date;
  valueAmount?: number;
  currency?: string;
  physicalVoucher: boolean;
  storageLocation?: string;
}

export interface OpportunityNotificationCandidate {
  userId: string;
  merchantEventId: string;
  opportunity: Opportunity;
}

export interface NotificationDraft {
  userId: string;
  voucherId: string;
  merchantEventId?: string;
  kind: 'EXPIRY' | 'OPPORTUNITY';
  channel: 'IN_APP';
  deliveryStatus: 'DELIVERED';
  dedupeKey: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  deliveredAt: Date;
}

export function dueReminderDays(
  validUntil: string | Date,
  now = new Date(),
  timeZone = DEFAULT_REMINDER_TIME_ZONE
): number | null {
  const days = calendarDaysUntil(validUntil, now, timeZone);
  return DEFAULT_REMINDER_DAYS.find(day => days === day) ?? null;
}

export function calendarDaysUntil(validUntil: string | Date, now: Date, timeZone: string): number {
  const expiry = typeof validUntil === 'string' ? new Date(validUntil) : validUntil;
  if (Number.isNaN(expiry.getTime()) || Number.isNaN(now.getTime())) throw new Error('Ungültiges Datum für Erinnerung.');
  return localDayNumber(expiry, timeZone) - localDayNumber(now, timeZone);
}

export function planExpiryNotifications(
  vouchers: ExpiryVoucherCandidate[],
  now = new Date(),
  timeZone = DEFAULT_REMINDER_TIME_ZONE
): NotificationDraft[] {
  return vouchers.flatMap(voucher => {
    const reminderDay = dueReminderDays(voucher.validUntil, now, timeZone);
    if (reminderDay == null) return [];
    const value = voucher.valueAmount == null
      ? undefined
      : new Intl.NumberFormat('de-DE', { style: 'currency', currency: voucher.currency ?? 'EUR' }).format(voucher.valueAmount);
    const storage = voucher.physicalVoucher && voucher.storageLocation
      ? `Aufbewahrung: ${voucher.storageLocation}.`
      : undefined;
    const timing = reminderDay === 0 ? 'läuft heute ab' : `läuft in ${reminderDay} Tagen ab`;

    return [{
      userId: voucher.userId,
      voucherId: voucher.id,
      kind: 'EXPIRY' as const,
      channel: 'IN_APP' as const,
      deliveryStatus: 'DELIVERED' as const,
      dedupeKey: `expiry:${voucher.id}:${reminderDay}:in-app`,
      title: reminderDay === 0 ? 'Gutschein läuft heute ab' : `Gutschein läuft in ${reminderDay} Tagen ab`,
      body: [
        `${voucher.merchantName}: ${voucher.title} ${timing}.`,
        value ? `Wert: ${value}.` : undefined,
        storage
      ].filter(Boolean).join(' '),
      payload: {
        reminderDay,
        validUntil: asIso(voucher.validUntil),
        merchantName: voucher.merchantName,
        storageLocation: voucher.storageLocation ?? null
      },
      deliveredAt: now
    }];
  });
}

export function planOpportunityNotifications(
  candidates: OpportunityNotificationCandidate[],
  now = new Date(),
  minimumScore = 50
): NotificationDraft[] {
  return candidates
    .filter(candidate => candidate.opportunity.relevanceScore >= minimumScore)
    .map(candidate => {
      const opportunity = candidate.opportunity;
      return {
        userId: candidate.userId,
        voucherId: opportunity.voucherId,
        merchantEventId: candidate.merchantEventId,
        kind: 'OPPORTUNITY' as const,
        channel: 'IN_APP' as const,
        deliveryStatus: 'DELIVERED' as const,
        dedupeKey: `opportunity:${opportunity.voucherId}:${candidate.merchantEventId}:in-app`,
        title: `Gutschein einsetzen: ${opportunity.title}`,
        body: `${opportunity.merchantName} · Relevanz ${opportunity.relevanceScore}/100 · ${opportunity.reason.join(' · ')}`,
        payload: {
          relevanceScore: opportunity.relevanceScore,
          startsAt: opportunity.startsAt ?? null,
          endsAt: opportunity.endsAt ?? null,
          sourceUrl: opportunity.sourceUrl ?? null,
          reasons: opportunity.reason
        },
        deliveredAt: now
      };
    });
}

function localDayNumber(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const year = Number(parts.find(part => part.type === 'year')?.value);
  const month = Number(parts.find(part => part.type === 'month')?.value);
  const day = Number(parts.find(part => part.type === 'day')?.value);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function asIso(value: string | Date) {
  return (typeof value === 'string' ? new Date(value) : value).toISOString();
}
