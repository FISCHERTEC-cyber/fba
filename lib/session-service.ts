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

export async function resolveSessionUser(sessionToken: string, now = new Date()) {
  const session = await prisma.userSession.findUnique({ where: { tokenHash: tokenHash(sessionToken) } });
  if (!session || session.revokedAt || session.expiresAt <= now) throw new Error('Anmeldung erforderlich.');
  const expiresAt = new Date(now.getTime() + SESSION_LEASE_MS);
  await prisma.$transaction([
    prisma.userSession.update({ where: { id: session.id }, data: { lastSeenAt: now, expiresAt } }),
    prisma.userDevice.update({ where: { id: session.deviceId }, data: { lastSeenAt: now } })
  ]);
  return session.userId;
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
