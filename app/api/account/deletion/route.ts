import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/request-user';
import { requestAccountDeletion } from '@/lib/data-portability-repository';

export async function POST(request: Request) {
  try { const userId = await requireUserId(request); return NextResponse.json({ request: await requestAccountDeletion(userId) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Kontolöschung konnte nicht angefordert werden.' }, { status: 400 }); }
}
