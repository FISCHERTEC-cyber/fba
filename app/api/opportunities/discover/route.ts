import { NextResponse } from 'next/server';
import { parseStructuredEvents } from '@/lib/event-source';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { merchantName?: string; sourceUrl?: string; html?: string };
    if (!body.merchantName?.trim()) throw new Error('merchantName fehlt.');
    if (!body.sourceUrl?.trim()) throw new Error('sourceUrl fehlt.');
    if (!body.html?.trim()) throw new Error('html fehlt.');

    const events = parseStructuredEvents(body.html, {
      merchantName: body.merchantName.trim(),
      url: body.sourceUrl.trim(),
      enabled: true
    });

    return NextResponse.json({ events, count: events.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Event-Erkennung fehlgeschlagen' },
      { status: 400 }
    );
  }
}
