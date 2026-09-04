import { NextResponse } from 'next/server';
import { requireScanJobToken } from '@/lib/job-auth';
import { listDueMerchantSourcesForScan } from '@/lib/merchant-source-repository';
import { scanMerchantSource } from '@/lib/merchant-source-scanner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireScanJobToken(request);
    const body = await request.json().catch(() => ({})) as { limit?: number };
    const limit = typeof body.limit === 'number' ? body.limit : 20;
    const sources = await listDueMerchantSourcesForScan(limit);
    const results = [];

    for (const source of sources) {
      results.push(await scanMerchantSource(source));
    }

    return NextResponse.json({
      checked: results.length,
      failed: results.filter(result => result.status === 'FAILED').length,
      results
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan-Aufruf fehlgeschlagen';
    const status = message.includes('autorisiert') ? 401 : message.includes('nicht konfiguriert') ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
