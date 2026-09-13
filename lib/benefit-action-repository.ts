import { Prisma } from '@prisma/client';
import { assertValidSnooze, isActionableForBadge } from './benefit-actions';
import { prisma } from './prisma';

const EXPIRING_WINDOW_MS = 10 * 60_000;

export async function reconcileBenefitActionItems(userId: string, now = new Date()) {
  await prisma.benefitReservation.updateMany({
    where: { userId, status: 'ACTIVE', expiresAt: { lte: now } },
    data: { status: 'EXPIRED' }
  });
  await prisma.benefitTransfer.updateMany({
    where: { OR: [{ senderUserId: userId }, { recipientUserId: userId }], status: 'PENDING', expiresAt: { lte: now } },
    data: { status: 'EXPIRED' }
  });

  const [transfers, reservations] = await Promise.all([
    prisma.benefitTransfer.findMany({
      where: { recipientUserId: userId, status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      include: { voucher: { select: { id: true, merchantName: true, title: true } } }
    }),
    prisma.benefitReservation.findMany({
      where: { userId, status: 'ACTIVE', expiresAt: { gt: now, lte: new Date(now.getTime() + EXPIRING_WINDOW_MS) } },
      include: { voucher: { select: { id: true, merchantName: true, title: true } } }
    })
  ]);

  const validTransferIds = new Set(transfers.map(item => item.id));
  const validReservationIds = new Set(reservations.map(item => item.id));
  const openItems = await prisma.benefitActionItem.findMany({
    where: { userId, status: { in: ['OPEN', 'SNOOZED'] }, OR: [{ transferId: { not: null } }, { reservationId: { not: null } }] }
  });
  await Promise.all(openItems.map(item => {
    const stillValid = item.transferId ? validTransferIds.has(item.transferId) : item.reservationId ? validReservationIds.has(item.reservationId) : true;
    if (stillValid) return Promise.resolve();
    return prisma.benefitActionItem.update({
      where: { id: item.id },
      data: { status: item.expiresAt && item.expiresAt <= now ? 'EXPIRED' : 'SUPERSEDED' }
    });
  }));

  await Promise.all([
    ...transfers.flatMap(transfer => [
      upsertAction({
        userId, voucherId: transfer.voucherId, transferId: transfer.id, type: 'ACCEPT_TRANSFER', priority: 'HIGH',
        dueAt: transfer.expiresAt, expiresAt: transfer.expiresAt,
        sourceKey: `transfer:${transfer.id}:decision`,
        payload: { merchantName: transfer.voucher.merchantName, title: transfer.voucher.title }
      }),
      ...(transfer.expiresAt && transfer.expiresAt.getTime() - now.getTime() <= 24 * 60 * 60 * 1000 ? [upsertAction({
        userId, voucherId: transfer.voucherId, transferId: transfer.id, type: 'TRANSFER_EXPIRING', priority: 'CRITICAL',
        dueAt: transfer.expiresAt, expiresAt: transfer.expiresAt,
        sourceKey: `transfer:${transfer.id}:expiring`,
        payload: { merchantName: transfer.voucher.merchantName, title: transfer.voucher.title }
      })] : [])
    ]),
    ...reservations.map(reservation => upsertAction({
      userId, voucherId: reservation.voucherId, reservationId: reservation.id, type: 'RESERVATION_EXPIRING', priority: 'HIGH',
      dueAt: reservation.expiresAt, expiresAt: reservation.expiresAt,
      sourceKey: `reservation:${reservation.id}:expiring`,
      payload: { merchantName: reservation.voucher.merchantName, title: reservation.voucher.title }
    }))
  ]);
}

type UpsertAction = {
  userId: string; voucherId?: string; reservationId?: string; transferId?: string;
  type: 'ACCEPT_TRANSFER' | 'TRANSFER_EXPIRING' | 'RESERVATION_EXPIRING';
  priority: 'HIGH' | 'CRITICAL'; dueAt?: Date | null; expiresAt?: Date | null;
  sourceKey: string; payload: Record<string, unknown>;
};

function upsertAction(input: UpsertAction) {
  return prisma.benefitActionItem.upsert({
    where: { sourceKey: input.sourceKey },
    create: { ...input, payload: input.payload as Prisma.InputJsonValue },
    update: { dueAt: input.dueAt, expiresAt: input.expiresAt, priority: input.priority, payload: input.payload as Prisma.InputJsonValue }
  });
}

export async function listBenefitActionItems(userId: string, now = new Date()) {
  await reconcileBenefitActionItems(userId, now);
  return prisma.benefitActionItem.findMany({
    where: { userId },
    include: { voucher: { select: { id: true, merchantName: true, title: true } } },
    orderBy: [{ status: 'asc' }, { priority: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    take: 100
  });
}

export async function countOpenBenefitActions(userId: string, now = new Date()) {
  await reconcileBenefitActionItems(userId, now);
  const candidates = await prisma.benefitActionItem.findMany({
    where: { userId, status: { in: ['OPEN', 'SNOOZED'] } }, select: { status: true, snoozedUntil: true }
  });
  return candidates.filter(item => isActionableForBadge(item, now)).length;
}

export async function updateBenefitActionItem(userId: string, id: string, action: 'SNOOZE' | 'DISMISS', resumeAt?: Date, now = new Date()) {
  const item = await prisma.benefitActionItem.findFirst({ where: { id, userId } });
  if (!item || !['OPEN', 'SNOOZED'].includes(item.status)) throw new Error('Diese Aufgabe ist nicht mehr offen. Bitte den aktuellen Stand laden.');
  if (action === 'DISMISS') {
    return prisma.benefitActionItem.update({ where: { id }, data: { status: 'DISMISSED', dismissedAt: now } });
  }
  if (!resumeAt) throw new Error('Zeitpunkt für die Erinnerung fehlt.');
  assertValidSnooze(resumeAt, item.expiresAt, now);
  return prisma.benefitActionItem.update({ where: { id }, data: { status: 'SNOOZED', snoozedUntil: resumeAt } });
}
