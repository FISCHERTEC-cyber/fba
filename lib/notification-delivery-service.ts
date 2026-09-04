import { prisma } from './prisma';
import {
  nextDeliveryAttemptAt,
  type EmailDeliveryAdapter
} from './notification-delivery';

export interface DispatchEmailOptions {
  now?: Date;
  limit?: number;
  maximumAttempts?: number;
  staleProcessingMinutes?: number;
}

export async function dispatchDueEmailNotifications(
  adapter: EmailDeliveryAdapter,
  options: DispatchEmailOptions = {}
) {
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(50, Math.trunc(options.limit ?? 20)));
  const maximumAttempts = Math.max(1, Math.min(10, Math.trunc(options.maximumAttempts ?? 5)));
  const staleBefore = new Date(now.getTime() - Math.max(5, options.staleProcessingMinutes ?? 15) * 60_000);
  const dueCondition = {
    OR: [
      { deliveryStatus: 'PENDING' as const, nextAttemptAt: null },
      { deliveryStatus: 'PENDING' as const, nextAttemptAt: { lte: now } },
      { deliveryStatus: 'PROCESSING' as const, processingStartedAt: { lte: staleBefore } }
    ]
  };
  const notifications = await prisma.notification.findMany({
    where: {
      channel: 'EMAIL',
      recipient: { not: null },
      ...dueCondition
    },
    orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
    take: limit
  });

  const results: Array<{ id: string; status: 'DELIVERED' | 'RETRY_SCHEDULED' | 'FAILED' }> = [];
  for (const notification of notifications) {
    const claim = await prisma.notification.updateMany({
      where: { id: notification.id, channel: 'EMAIL', ...dueCondition },
      data: { deliveryStatus: 'PROCESSING', processingStartedAt: now }
    });
    if (!claim.count || !notification.recipient) continue;

    const attemptNumber = notification.attemptCount + 1;
    try {
      const delivery = await adapter.send({
        notificationId: notification.id,
        to: notification.recipient,
        subject: notification.title,
        text: notification.body,
        metadata: notification.payload
      });
      await prisma.$transaction([
        prisma.notification.update({
          where: { id: notification.id },
          data: {
            deliveryStatus: 'DELIVERED',
            deliveredAt: now,
            attemptCount: attemptNumber,
            nextAttemptAt: null,
            processingStartedAt: null,
            lastError: null,
            providerMessageId: delivery.providerMessageId
          }
        }),
        prisma.notificationDeliveryAttempt.create({
          data: {
            notificationId: notification.id,
            attemptNumber,
            successful: true,
            providerMessageId: delivery.providerMessageId
          }
        })
      ]);
      results.push({ id: notification.id, status: 'DELIVERED' });
    } catch (error) {
      const finalFailure = attemptNumber >= maximumAttempts;
      const message = deliveryErrorMessage(error);
      await prisma.$transaction([
        prisma.notification.update({
          where: { id: notification.id },
          data: {
            deliveryStatus: finalFailure ? 'FAILED' : 'PENDING',
            attemptCount: attemptNumber,
            nextAttemptAt: finalFailure ? null : nextDeliveryAttemptAt(attemptNumber, now),
            processingStartedAt: null,
            lastError: message
          }
        }),
        prisma.notificationDeliveryAttempt.create({
          data: {
            notificationId: notification.id,
            attemptNumber,
            successful: false,
            error: message
          }
        })
      ]);
      results.push({
        id: notification.id,
        status: finalFailure ? 'FAILED' : 'RETRY_SCHEDULED'
      });
    }
  }

  return {
    claimed: results.length,
    delivered: results.filter(result => result.status === 'DELIVERED').length,
    retryScheduled: results.filter(result => result.status === 'RETRY_SCHEDULED').length,
    failed: results.filter(result => result.status === 'FAILED').length,
    results
  };
}

function deliveryErrorMessage(error: unknown) {
  return (error instanceof Error ? error.message : 'Unbekannter Zustellfehler').slice(0, 1_000);
}
