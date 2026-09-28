import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/request-user';
import { createVoucherCredential, issueOfflineCredentialCache, listVoucherCredentials, revealVoucherCredential } from '@/lib/redemption-wallet-repository';
import { cookieValue, currentDeviceId, SESSION_COOKIE } from '@/lib/session-service';

const createSchema = z.object({ kind: z.enum(['REDEMPTION_CODE', 'PIN', 'BARCODE', 'QR_PAYLOAD', 'ACCOUNT_NUMBER', 'EXTERNAL_TOKEN']), value: z.string().min(1).max(10_000), label: z.string().max(120).optional(), secretClass: z.enum(['CONFIDENTIAL', 'RESTRICTED']).optional() });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const userId = await requireUserId(request); const { id } = await params; return NextResponse.json({ credentials: await listVoucherCredentials(userId, id) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Credentials konnten nicht geladen werden.' }, { status: 400 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const userId = await requireUserId(request); const { id } = await params; const body = createSchema.parse(await request.json()); return NextResponse.json({ credential: await createVoucherCredential({ userId, voucherId: id, ...body }) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Credential konnte nicht gespeichert werden.' }, { status: 400 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId(request); const { id } = await params;
    const body = z.object({ credentialId: z.string().min(1), operation: z.enum(['REVEAL', 'ISSUE_OFFLINE_CACHE']), expiresInMinutes: z.number().int().optional() }).parse(await request.json());
    if (body.operation === 'REVEAL') return NextResponse.json({ credential: await revealVoucherCredential(userId, id, body.credentialId) });
    const deviceId = await currentDeviceId(userId, cookieValue(request, SESSION_COOKIE));
    return NextResponse.json({ offlineCache: await issueOfflineCredentialCache({ userId, deviceId, voucherId: id, credentialId: body.credentialId, expiresInMinutes: body.expiresInMinutes }) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Credential-Aktion konnte nicht ausgeführt werden.' }, { status: 400 }); }
}
