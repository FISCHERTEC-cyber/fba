import { NextResponse } from 'next/server';
import { z } from 'zod';
import { removeFamilyWalletMember } from '@/lib/family-wallet-repository';
import { requireUserId } from '@/lib/request-user';

const bodySchema = z.object({ userId: z.string().trim().min(1).max(200) });

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId(request);
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());
    await removeFamilyWalletMember(userId, id, body.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mitglied konnte nicht entfernt werden.';
    return NextResponse.json({ error: message }, { status: message === 'Anmeldung erforderlich.' ? 401 : 400 });
  }
}
