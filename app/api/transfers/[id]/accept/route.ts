import { NextResponse } from 'next/server';
import { acceptVoucherTransfer } from '@/lib/voucher-repository';
import { requireUserId } from '@/lib/request-user';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId(request);
    const { id } = await params;
    const transfer = await acceptVoucherTransfer(userId, id);
    return NextResponse.json({ transfer });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Annahme fehlgeschlagen.' }, { status: 400 });
  }
}
