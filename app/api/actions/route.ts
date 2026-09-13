import { NextResponse } from 'next/server';
import { countOpenBenefitActions, listBenefitActionItems, updateBenefitActionItem } from '@/lib/benefit-action-repository';
import { requireUserId } from '@/lib/request-user';

export async function GET(request: Request) {
  try {
    const userId = await requireUserId(request);
    const [items, badgeCount] = await Promise.all([listBenefitActionItems(userId), countOpenBenefitActions(userId)]);
    return NextResponse.json({ items, badgeCount });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Aufgaben konnten nicht geladen werden.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireUserId(request);
    const body = await request.json() as { id?: string; action?: 'SNOOZE' | 'DISMISS'; resumeAt?: string };
    if (!body.id?.trim() || (body.action !== 'SNOOZE' && body.action !== 'DISMISS')) throw new Error('Aufgabe oder Aktion ist ungültig.');
    const resumeAt = body.resumeAt ? new Date(body.resumeAt) : undefined;
    if (resumeAt && Number.isNaN(resumeAt.getTime())) throw new Error('Zeitpunkt für die Erinnerung ist ungültig.');
    const item = await updateBenefitActionItem(userId, body.id, body.action, resumeAt);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Aufgabe konnte nicht aktualisiert werden.' }, { status: 400 });
  }
}
