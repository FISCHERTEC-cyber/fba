import { NextResponse } from 'next/server';
import { z } from 'zod';
import { acceptFamilyWalletInvitation } from '@/lib/family-wallet-repository';
import { requireUserId } from '@/lib/request-user';

const bodySchema = z.object({ token: z.string().trim().min(32).max(200) });

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    const { token } = bodySchema.parse(await request.json());
    return NextResponse.json(await acceptFamilyWalletInvitation(userId, token));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Einladung konnte nicht angenommen werden.';
    return NextResponse.json({ error: message }, { status: message === 'Anmeldung erforderlich.' ? 401 : 400 });
  }
}
