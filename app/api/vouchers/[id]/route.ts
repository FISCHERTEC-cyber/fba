import { NextResponse } from 'next/server';
import { getVoucherDetail } from '@/lib/voucher-repository';
import { requireUserId } from '@/lib/request-user';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId(request);
    const { id } = await params;
    return NextResponse.json({ voucher: await getVoucherDetail(userId, id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gutschein konnte nicht geladen werden.' }, { status: 400 });
  }
}
