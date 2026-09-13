import { NextResponse } from 'next/server';
import { releaseVoucherReservation, reserveVoucher } from '@/lib/voucher-repository';
import { requireUserId } from '@/lib/request-user';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const userId = await requireUserId(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as { expiresInMinutes?: number };
    const reservation = await reserveVoucher(userId, id, body.expiresInMinutes ?? 30);
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Reservierung fehlgeschlagen.' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const userId = await requireUserId(request);
    const { id } = await params;
    await releaseVoucherReservation(userId, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Freigabe fehlgeschlagen.' }, { status: 400 });
  }
}
