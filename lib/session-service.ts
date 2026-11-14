import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { MAX_DEVICES, newOpaqueToken, SESSION_LEASE_MS, tokenHash } from './session-security';

export { DEVICE_COOKIE, SESSION_COOKIE, cookieValue } from './session-security';

export async function createUserSession(input: {
  supabaseUserId: string; email: string; deviceToken?: string; deviceName?: string; takeOver?: boolean; now?: Date;
}) {
  const now = input.now ?? new Date();
  const deviceToken = input.deviceToken || newOpaqueToken();
  const sessionToken = newOpaqueToken();
  const expiresAt = new Date(now.getTime() + SESSION_LEASE_MS);

  const result = await prisma.$transaction(async tx => {
    const existingUser = await tx.user.findFirst({
      where: { OR: [{ supabaseUserId: input.supabaseUserId }, { email: input.email }] }
    });
    if (existingUser && !existingUser.supabaseUserId) {
      throw new Error('Dieses bestehende Konto muss vor der Anmeldung sicher verknüpft werden.');
    }
    if (existingUser?.supabaseUserId && existingUser.supabaseUserId !== input.supabaseUserId) {
      throw new Error('Die Identität stimmt nicht mit dem verknüpften Konto überein.');
    }
    const user = existingUser
      ? await tx.user.update({ where: { id: existingUser.id }, data: { supabaseUserId: input.supabaseUserId, email: input.email } })
      : await tx.user.create({ data: { supabaseUserId: input.supabaseUserId, email: input.email } });
    let device = await tx.userDevice.findUnique({ where: { userId_tokenHash: { userId: user.id, tokenHash: tokenHash(deviceToken) } } });
    if (device?.revokedAt) device = null;
    if (!device) {
      const count = await tx.userDevice.count({ where: { userId: user.id, revokedAt: null } });
      if (count >= MAX_DEVICES) throw new Error('Maximal fünf aktive Geräte sind zulässig. Ein Gerät muss zuerst abgemeldet werden.');
      device = await tx.userDevice.create({ data: { userId: user.id, tokenHash: tokenHash(deviceToken), name: input.deviceName?.slice(0, 120), lastSeenAt: now } });
    }
    const active = await tx.userSession.findFirst({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: now } } });
    if (active && active.deviceId !== device.id && !input.takeOver) {
      throw new Error('ACTIVE_SESSION_EXISTS');
    }
    await tx.userSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
    await tx.userDevice.update({ where: { id: device.id }, data: { lastSeenAt: now, name: input.deviceName?.slice(0, 120) || device.name } });
    await tx.userSession.create({ data: { userId: user.id, deviceId: device.id, tokenHash: tokenHash(sessionToken), expiresAt, lastSeenAt: now } });
    return { userId: user.id, email: user.email };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { ...result, deviceToken, sessionToken, expiresAt };
}

export async function resolveSessionUser(sessionToken: string, now?: Date) {
  const hash = tokenHash(sessionToken);
  return prisma.$transaction(async tx => {
    // Lock before evaluating expiry so a request waiting on a concurrent
    // revocation cannot renew a session that expired while it was blocked.
    const rows = await tx.$queryRaw<Array<{id: string}>>`SELECT "id" FROM "UserSession" WHERE "tokenHash" = ${hash} FOR UPDATE`;
    if (rows.length !== 1) throw new Error('Anmeldung erforderlich.');
    const checkedAt = now ?? new Date();
    const updated = await tx.userSession.updateMany({
      where: { id: rows[0].id, revokedAt: null, expiresAt: { gt: checkedAt } },
      data: { lastSeenAt: checkedAt, expiresAt: new Date(checkedAt.getTime() + SESSION_LEASE_MS) }
    });
    if (updated.count !== 1) throw new Error('Anmeldung erforderlich.');
    const session = await tx.userSession.findUniqueOrThrow({ where: { id: rows[0].id } });
    const device = await tx.userDevice.updateMany({
      where: { id: session.deviceId, revokedAt: null },
      data: { lastSeenAt: checkedAt }
    });
    if (device.count !== 1) throw new Error('Anmeldung erforderlich.');
    return session.userId;
  });
}

export async function revokeSession(sessionToken?: string, now = new Date()) {
  if (!sessionToken) return;
  await prisma.userSession.updateMany({ where: { tokenHash: tokenHash(sessionToken), revokedAt: null }, data: { revokedAt: now } });
}

export async function listUserDevices(userId: string, sessionToken?: string) {
  const [devices, session] = await Promise.all([
    prisma.userDevice.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, name: true, lastSeenAt: true, createdAt: true },
    orderBy: { lastSeenAt: 'desc' }
    }),
    sessionToken ? prisma.userSession.findUnique({ where: { tokenHash: tokenHash(sessionToken) }, select: { deviceId: true } }) : null
  ]);
  return devices.map(device => ({ ...device, current: device.id === session?.deviceId }));
}

export async function revokeUserDevice(userId: string, deviceId: string, now = new Date()) {
  return prisma.$transaction(async tx => {
    const device = await tx.userDevice.findFirst({ where: { id: deviceId, userId, revokedAt: null } });
    if (!device) throw new Error('Gerät wurde nicht gefunden.');
    await tx.userSession.updateMany({ where: { deviceId, revokedAt: null }, data: { revokedAt: now } });
    await tx.userDevice.update({ where: { id: deviceId }, data: { revokedAt: now } });
  });
}
