import { NextResponse } from 'next/server';
import { requireNotificationJobToken } from '@/lib/job-auth';
import { createEmailDeliveryAdapterFromEnv } from '@/lib/notification-delivery';
import { dispatchDueEmailNotifications } from '@/lib/notification-delivery-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireNotificationJobToken(request);
    const body = await request.json().catch(() => ({})) as { limit?: number };
    if (body.limit != null && (!Number.isFinite(body.limit) || body.limit < 1 || body.limit > 50)) {
      throw new Error('limit muss zwischen 1 und 50 liegen.');
    }
    const result = await dispatchDueEmailNotifications(
      createEmailDeliveryAdapterFromEnv(),
      { limit: body.limit }
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Benachrichtigungsversand fehlgeschlagen';
    const status = message.includes('autorisiert') ? 401 : message.includes('nicht konfiguriert') ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
