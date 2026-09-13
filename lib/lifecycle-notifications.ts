import type { Prisma } from '@prisma/client';
import {
  decideLifecycleDelivery,
  lifecycleEventFamily,
  lifecycleNotificationDedupeKey,
  lifecycleNotificationText,
  lifecyclePriority,
  obsoleteLifecycleEventsFor,
  sanitizeNotificationPayload,
  type LifecycleNotificationEvent
} from './notification-governance';
import { prisma } from './prisma';

type TransactionClient = Prisma.TransactionClient;

export interface EmitLifecycleNotificationInput {
  event: LifecycleNotificationEvent;
  userId: string;
  voucherId: string;
  merchantName: string;
  transferId?: string | null;
  reservationId?: string | null;
  expiresAt?: Date | null;
  payload?: Record<string, unknown>;
}

export async function emitLifecycleNotification(
  transaction: TransactionClient,
  input: EmitLifecycleNotificationInput
) {
  const entityId = input.transferId ?? input.reservationId ?? input.voucherId;
  const text = lifecycleNotificationText(input.event, input.merchantName);
  const payload = sanitizeNotificationPayload({
    eventType: input.event,
    voucherId: input.voucherId,
    transferId: input.transferId ?? undefined,
    reservationId: input.reservationId ?? undefined,
    ...input.payload
  });
  const eventFamily = lifecycleEventFamily(input.event);
  const [preference, recipient] = await Promise.all([
    transaction.notificationPreference.findUnique({
      where: { userId_eventFamily: { userId: input.userId, eventFamily } }
    }),
    transaction.user.findUnique({ where: { id: input.userId }, select: { email: true } })
  ]);
  const decision = decideLifecycleDelivery(input.event, preference);

  await supersedeObsoleteLifecycleNotifications(transaction, input);

  const notifications = [];
  for (const channel of decision.channels) {
    if (channel === 'PUSH') continue;
    const dedupeKey = lifecycleNotificationDedupeKey(input.event, entityId, input.userId, channel);
    notifications.push(await transaction.notification.upsert({
      where: { dedupeKey },
      create: {
        userId: input.userId,
        voucherId: input.voucherId,
        transferId: input.transferId ?? null,
        reservationId: input.reservationId ?? null,
        eventType: input.event,
        eventFamily,
        priority: lifecyclePriority(input.event),
        kind: 'LIFECYCLE',
        channel,
        deliveryStatus: channel === 'IN_APP' ? 'DELIVERED' : 'PENDING',
        dedupeKey,
        title: text.title,
        body: text.body,
        payload,
        recipient: channel === 'EMAIL' ? recipient?.email ?? null : null,
        expiresAt: input.expiresAt ?? null,
        nextAttemptAt: channel === 'EMAIL' ? new Date() : null,
        deliveredAt: channel === 'IN_APP' ? new Date() : null
      },
      update: {
        title: text.title,
        body: text.body,
        payload,
        priority: lifecyclePriority(input.event),
        expiresAt: input.expiresAt ?? null,
        recipient: channel === 'EMAIL' ? recipient?.email ?? null : null,
        deliveryStatus: channel === 'IN_APP' ? 'DELIVERED' : 'PENDING',
        nextAttemptAt: channel === 'EMAIL' ? new Date() : null,
        dismissedAt: null
      }
    }));
  }
  return { notifications, suppressed: decision.suppressed };
}

async function supersedeObsoleteLifecycleNotifications(
  transaction: TransactionClient,
  input: EmitLifecycleNotificationInput
) {
  const obsoleteEvents = obsoleteLifecycleEventsFor(input.event);
  if (!obsoleteEvents.length) return;
  await transaction.notification.updateMany({
    where: {
      eventType: { in: obsoleteEvents },
      ...(input.transferId ? { transferId: input.transferId } : {}),
      ...(input.reservationId ? { reservationId: input.reservationId } : {}),
      deliveryStatus: { in: ['PENDING', 'PROCESSING', 'DELIVERED'] }
    },
    data: { deliveryStatus: 'SUPERSEDED' }
  });
}

export async function reconcileLifecycleWarnings(now = new Date()) {
  return prisma.$transaction(async transaction => {
    const [reservations, transfers] = await Promise.all([
      transaction.benefitReservation.findMany({
        where: { status: 'ACTIVE' },
        include: { voucher: { select: { id: true, merchantName: true } } }
      }),
      transaction.benefitTransfer.findMany({
        where: { status: 'PENDING' },
        include: { voucher: { select: { id: true, merchantName: true } } }
      })
    ]);

    let createdOrUpdated = 0;
    let expired = 0;
    for (const reservation of reservations) {
      if (reservation.expiresAt <= now) {
        await transaction.benefitReservation.update({ where: { id: reservation.id }, data: { status: 'EXPIRED' } });
        await transaction.benefitAuditEvent.create({
          data: {
            voucherId: reservation.voucherId,
            action: 'EXPIRED',
            details: { reservationId: reservation.id, reason: 'RESERVATION_EXPIRED' }
          }
        });
        await emitLifecycleNotification(transaction, {
          event: 'RESERVATION_EXPIRED', userId: reservation.userId, voucherId: reservation.voucherId,
          reservationId: reservation.id, merchantName: reservation.voucher.merchantName
        });
        expired += 1;
        continue;
      }
      if (reservation.expiresAt.getTime() - now.getTime() <= 5 * 60_000) {
        await emitLifecycleNotification(transaction, {
          event: 'RESERVATION_EXPIRING', userId: reservation.userId, voucherId: reservation.voucherId,
          reservationId: reservation.id, merchantName: reservation.voucher.merchantName, expiresAt: reservation.expiresAt
        });
        createdOrUpdated += 1;
      }
    }

    for (const transfer of transfers) {
      if (transfer.expiresAt && transfer.expiresAt <= now) {
        await transaction.benefitTransfer.update({ where: { id: transfer.id }, data: { status: 'EXPIRED' } });
        await transaction.benefitAuditEvent.create({
          data: {
            voucherId: transfer.voucherId,
            action: 'EXPIRED',
            details: { transferId: transfer.id, reason: 'TRANSFER_EXPIRED' }
          }
        });
        await transaction.notification.updateMany({
          where: { transferId: transfer.id, eventType: 'TRANSFER_EXPIRING', deliveryStatus: { in: ['PENDING', 'PROCESSING', 'DELIVERED'] } },
          data: { deliveryStatus: 'SUPERSEDED' }
        });
        expired += 1;
        continue;
      }
      if (transfer.expiresAt && transfer.recipientUserId && transfer.expiresAt.getTime() - now.getTime() <= 6 * 60 * 60_000) {
        await emitLifecycleNotification(transaction, {
          event: 'TRANSFER_EXPIRING', userId: transfer.recipientUserId, voucherId: transfer.voucherId,
          transferId: transfer.id, merchantName: transfer.voucher.merchantName, expiresAt: transfer.expiresAt
        });
        createdOrUpdated += 1;
      }
    }

    return { createdOrUpdated, expired };
  });
}
