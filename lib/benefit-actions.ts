export const ACTIONABLE_STATUSES = new Set(['OPEN', 'SNOOZED']);

export function isActionableForBadge(action: { status: string; snoozedUntil?: Date | null }, now = new Date()) {
  return ACTIONABLE_STATUSES.has(action.status) && (!action.snoozedUntil || action.snoozedUntil <= now);
}

export function assertValidSnooze(resumeAt: Date, expiresAt: Date | null | undefined, now = new Date()) {
  if (!Number.isFinite(resumeAt.getTime()) || resumeAt <= now) {
    throw new Error('Die Erinnerung muss in der Zukunft liegen.');
  }
  if (expiresAt && resumeAt >= expiresAt) {
    throw new Error('Die Erinnerung kann nicht nach dem Ablauf der Aufgabe liegen.');
  }
}

export function actionBucket(action: { priority: string; dueAt?: Date | null; expiresAt?: Date | null; status: string; snoozedUntil?: Date | null }, now = new Date()) {
  if (!ACTIONABLE_STATUSES.has(action.status)) return 'DONE';
  if (action.snoozedUntil && action.snoozedUntil > now) return 'UPCOMING';
  if (action.priority === 'CRITICAL' || action.priority === 'HIGH') return 'NOW';
  const dueAt = action.dueAt ?? action.expiresAt;
  if (dueAt && dueAt.getTime() - now.getTime() <= 24 * 60 * 60 * 1000) return 'NOW';
  return action.priority === 'NORMAL' ? 'UPCOMING' : 'REVIEW';
}
