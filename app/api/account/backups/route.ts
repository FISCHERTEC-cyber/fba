import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/request-user';
import { createBackupProfile } from '@/lib/data-portability-repository';

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    const body = z.object({ name: z.string().min(2).max(80), format: z.enum(['JSON', 'CSV', 'ZIP', 'PDF']).optional(), includeSensitiveData: z.boolean().optional(), includeAuditData: z.boolean().optional(), retentionDays: z.number().int().optional() }).parse(await request.json());
    return NextResponse.json({ profile: await createBackupProfile({ userId, ...body }) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Backup-Profil konnte nicht angelegt werden.' }, { status: 400 }); }
}
