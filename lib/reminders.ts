export const DEFAULT_REMINDER_DAYS = [30, 14, 7, 2, 0] as const;

export function dueReminderDays(validUntil: string, now = new Date()): number | null {
  const expiry = new Date(validUntil);
  const days = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
  return DEFAULT_REMINDER_DAYS.find(d => days === d) ?? null;
}
