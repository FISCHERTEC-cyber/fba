import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/request-user';
import { recordRedemption } from '@/lib/voucher-repository';

const bodySchema = z.object({
  amount: z.number().positive().finite().optional(),
  note: z.string().max(500).optional(),
  receiptUrl: z.string().url().max(2_000).optional(),
  redeemCompletely: z.boolean().optional()
}).refine(value => value.amount !== undefined || value.redeemCompletely === true, {
  message: 'Einlösebetrag oder vollständige Einlösung fehlt.'
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId(request);
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());
    const result = await recordRedemption({ userId, voucherId: id, ...body });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Einlösung konnte nicht gespeichert werden.' },
      { status: 400 }
    );
  }
}
