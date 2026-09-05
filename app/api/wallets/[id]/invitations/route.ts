import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createFamilyWalletInvitation,
  revokeFamilyWalletInvitation
} from '@/lib/family-wallet-repository';
import { requireUserId } from '@/lib/request-user';

const bodySchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(['MEMBER', 'VIEWER'])
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId(request);
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());
    const invitation = await createFamilyWalletInvitation({ userId, walletId: id, ...body });
    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Einladung konnte nicht erstellt werden.';
    return NextResponse.json({ error: message }, { status: message === 'Anmeldung erforderlich.' ? 401 : 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId(request);
    const { id } = await context.params;
    const { invitationId } = z.object({ invitationId: z.string().trim().min(1).max(200) }).parse(await request.json());
    await revokeFamilyWalletInvitation(userId, id, invitationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Einladung konnte nicht widerrufen werden.';
    return NextResponse.json({ error: message }, { status: message === 'Anmeldung erforderlich.' ? 401 : 400 });
  }
}
