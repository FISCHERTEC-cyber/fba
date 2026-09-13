import { NextResponse } from 'next/server';
import { listVoucherAudit } from '@/lib/voucher-repository';
import { requireUserId } from '@/lib/request-user';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId(request);
    const { id } = await params;
    return NextResponse.json({ events: await listVoucherAudit(userId, id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Audit konnte nicht geladen werden.' }, { status: 400 });
  }
}
