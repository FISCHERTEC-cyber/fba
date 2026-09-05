import { NextResponse } from 'next/server';
import { listPendingImportCandidates } from '@/lib/import-candidate-repository';
import { requireUserId } from '@/lib/request-user';

export async function GET(request: Request) {
  try {
    const userId = await requireUserId(request);
    return NextResponse.json({ candidates: await listPendingImportCandidates(userId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Importkandidaten konnten nicht geladen werden.' },
      { status: 400 }
    );
  }
}
