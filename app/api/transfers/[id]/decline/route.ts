import { NextResponse } from 'next/server';
import { declineVoucherTransfer } from '@/lib/voucher-repository';
import { requireUserId } from '@/lib/request-user';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const userId = await requireUserId(request); const { id } = await params; await declineVoucherTransfer(userId, id); return new NextResponse(null, { status: 204 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Ablehnen fehlgeschlagen.' }, { status: 400 }); }
}
