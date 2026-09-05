import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/request-user';
import { createFamilyWallet, listFamilyWallets } from '@/lib/family-wallet-repository';

const createSchema = z.object({ name: z.string().trim().min(2).max(80) });

export async function GET(request: Request) {
  try {
    const userId = await requireUserId(request);
    return NextResponse.json({ wallets: await listFamilyWallets(userId) });
  } catch (error) {
    return walletError(error, 'Wallets konnten nicht geladen werden.');
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    const body = createSchema.parse(await request.json());
    return NextResponse.json({ wallet: await createFamilyWallet(userId, body.name) }, { status: 201 });
  } catch (error) {
    return walletError(error, 'Wallet konnte nicht angelegt werden.');
  }
}

function walletError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: message === 'Anmeldung erforderlich.' ? 401 : 400 });
}
