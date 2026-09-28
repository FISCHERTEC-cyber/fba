import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/request-user';
import { completeDataExport, requestDataExport } from '@/lib/data-portability-repository';

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    const body = z.object({ format: z.enum(['JSON', 'CSV', 'ZIP', 'PDF']).optional(), includeSensitiveData: z.boolean().optional(), includeAuditData: z.boolean().optional(), includeAttachments: z.boolean().optional(), completeNow: z.boolean().optional() }).parse(await request.json());
    const item = await requestDataExport({ userId, ...body });
    return NextResponse.json(body.completeNow ? { request: item, result: await completeDataExport(userId, item.id) } : { request: item }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Export konnte nicht angefordert werden.' }, { status: 400 }); }
}
