import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/request-user';
import { previewRestore } from '@/lib/data-portability-repository';

export async function POST(request: Request) {
  try { const userId = await requireUserId(request); const body = z.object({ manifest: z.unknown(), payload: z.unknown() }).parse(await request.json()) as { manifest: unknown; payload: unknown }; return NextResponse.json({ preview: await previewRestore(userId, body) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Restore-Vorschau konnte nicht erstellt werden.' }, { status: 400 }); }
}
