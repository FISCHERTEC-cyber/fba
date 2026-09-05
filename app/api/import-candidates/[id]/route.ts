import { NextResponse } from 'next/server';
import { z } from 'zod';
import { voucherExtractionSchema } from '@/lib/extraction';
import { dismissImportCandidate, importCandidateAsVoucher } from '@/lib/import-candidate-repository';
import { requireUserId } from '@/lib/request-user';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('DISMISS') }),
  z.object({
    action: z.literal('IMPORT'),
    extraction: voucherExtractionSchema,
    confirmedFields: z.array(z.string().max(100)).max(50).default([])
  })
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = requireUserId(request);
    const { id } = await context.params;
    const body = actionSchema.parse(await request.json());
    if (body.action === 'DISMISS') {
      await dismissImportCandidate(userId, id);
      return NextResponse.json({ status: 'DISMISSED' });
    }
    const voucher = await importCandidateAsVoucher({
      userId, id, extraction: body.extraction, confirmedFields: body.confirmedFields
    });
    return NextResponse.json({ status: 'IMPORTED', voucher });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Importkandidat konnte nicht verarbeitet werden.' },
      { status: 400 }
    );
  }
}
