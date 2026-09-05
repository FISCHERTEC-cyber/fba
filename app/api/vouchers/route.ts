import { NextResponse } from 'next/server';
import { voucherExtractionSchema } from '@/lib/extraction';
import { requireUserId } from '@/lib/request-user';
import { listActiveVouchers, saveReviewedVoucher } from '@/lib/voucher-repository';

export async function GET(request: Request) {
  try {
    const userId = await requireUserId(request);
    const vouchers = await listActiveVouchers(userId);
    return NextResponse.json({ vouchers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gutscheine konnten nicht geladen werden' },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    const body = await request.json() as { extraction?: unknown; confirmedFields?: string[] };
    const extraction = voucherExtractionSchema.parse(body.extraction);
    const voucher = await saveReviewedVoucher({
      userId,
      extraction,
      confirmedFields: body.confirmedFields ?? []
    });
    return NextResponse.json({ voucher }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gutschein konnte nicht gespeichert werden' },
      { status: 400 }
    );
  }
}
