import { NextResponse } from 'next/server';
import { cancelVoucherTransfer, startVoucherTransfer } from '@/lib/voucher-repository';
import { requireUserId } from '@/lib/request-user';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const userId = await requireUserId(request);
    const { id } = await params;
    const body = await request.json() as { recipientUserId?: string; expiresInHours?: number };
    const transfer = await startVoucherTransfer(userId, id, body.recipientUserId ?? '', body.expiresInHours ?? 72);
    return NextResponse.json({ transfer }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Übertragung fehlgeschlagen.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireUserId(request);
    const transferId = new URL(request.url).searchParams.get('transferId');
    if (!transferId) throw new Error('transferId fehlt.');
    await cancelVoucherTransfer(userId, transferId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Abbruch fehlgeschlagen.' }, { status: 400 });
  }
}
