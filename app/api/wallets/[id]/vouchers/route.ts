import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  assignVoucherToFamilyWallet,
  removeVoucherFromFamilyWallet
} from '@/lib/family-wallet-repository';
import { requireUserId } from '@/lib/request-user';

const bodySchema = z.object({ voucherId: z.string().trim().min(1).max(200) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return changeVoucherAssignment(request, context, 'ASSIGN');
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return changeVoucherAssignment(request, context, 'REMOVE');
}

async function changeVoucherAssignment(
  request: Request,
  context: { params: Promise<{ id: string }> },
  action: 'ASSIGN' | 'REMOVE'
) {
  try {
    const userId = await requireUserId(request);
    const { id } = await context.params;
    const { voucherId } = bodySchema.parse(await request.json());
    if (action === 'ASSIGN') await assignVoucherToFamilyWallet(userId, id, voucherId);
    else await removeVoucherFromFamilyWallet(userId, id, voucherId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Wallet-Zuordnung konnte nicht geändert werden.';
    return NextResponse.json({ error: message }, { status: message === 'Anmeldung erforderlich.' ? 401 : 400 });
  }
}
