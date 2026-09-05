import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/request-user';
import { cookieValue, listUserDevices, revokeUserDevice, SESSION_COOKIE } from '@/lib/session-service';

export async function GET(request: Request) {
  try {
    const userId = await requireUserId(request);
    return NextResponse.json({ devices: await listUserDevices(userId, cookieValue(request, SESSION_COOKIE)), maximum: 5 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Geräte konnten nicht geladen werden.' }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireUserId(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());
    const devices = await listUserDevices(userId, cookieValue(request, SESSION_COOKIE));
    const currentRemoved = devices.some(device => device.id === id && device.current);
    await revokeUserDevice(userId, id);
    return NextResponse.json({ revoked: true, currentRemoved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gerät konnte nicht entfernt werden.' }, { status: 400 });
  }
}
