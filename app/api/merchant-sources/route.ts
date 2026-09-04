import { NextResponse } from 'next/server';
import { registerMerchantSource, listDueMerchantSources } from '@/lib/merchant-source-repository';
import { requireUserId } from '@/lib/request-user';

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const sources = await listDueMerchantSources(userId);
    return NextResponse.json({ dueSources: sources });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Händlerquellen konnten nicht geladen werden' },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = requireUserId(request);
    const body = await request.json() as {
      merchantName?: string;
      url?: string;
      checkIntervalHours?: number;
    };

    if (!body.merchantName?.trim()) throw new Error('merchantName fehlt.');
    if (!body.url?.trim()) throw new Error('url fehlt.');

    const source = await registerMerchantSource({
      userId,
      merchantName: body.merchantName,
      url: body.url,
      checkIntervalHours: body.checkIntervalHours
    });

    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Händlerquelle konnte nicht gespeichert werden' },
      { status: 400 }
    );
  }
}
