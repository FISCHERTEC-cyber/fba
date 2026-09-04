import { NextResponse } from 'next/server';
import {
  countUnreadNotifications,
  listNotifications,
  updateNotificationState
} from '@/lib/notification-repository';
import { requireUserId } from '@/lib/request-user';

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const limitValue = Number(url.searchParams.get('limit') ?? 50);
    if (!Number.isFinite(limitValue)) throw new Error('limit ist ungültig.');
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(userId, { unreadOnly, limit: limitValue }),
      countUnreadNotifications(userId)
    ]);
    return NextResponse.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Benachrichtigungen konnten nicht geladen werden' },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = requireUserId(request);
    const body = await request.json() as { id?: string; action?: 'READ' | 'DISMISS' };
    if (!body.id?.trim()) throw new Error('id fehlt.');
    if (body.action !== 'READ' && body.action !== 'DISMISS') throw new Error('action ist ungültig.');
    await updateNotificationState(userId, body.id, body.action);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Benachrichtigung konnte nicht aktualisiert werden' },
      { status: 400 }
    );
  }
}
