import { NextResponse } from 'next/server';
import { requireNotificationJobToken } from '@/lib/job-auth';
import { generateDueNotifications } from '@/lib/notification-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireNotificationJobToken(request);
    const body = await request.json().catch(() => ({})) as {
      timeZone?: string;
      minimumOpportunityScore?: number;
    };
    const minimumOpportunityScore = body.minimumOpportunityScore ?? 50;
    if (!Number.isFinite(minimumOpportunityScore) || minimumOpportunityScore < 0 || minimumOpportunityScore > 100) {
      throw new Error('minimumOpportunityScore muss zwischen 0 und 100 liegen.');
    }

    const result = await generateDueNotifications({
      timeZone: body.timeZone,
      minimumOpportunityScore
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Benachrichtigungsjob fehlgeschlagen';
    const status = message.includes('autorisiert') ? 401 : message.includes('nicht konfiguriert') ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
