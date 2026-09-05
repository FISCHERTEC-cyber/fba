import { NextResponse } from 'next/server';
import { DecoderTextProvider } from '@/lib/binary-import';
import { HeuristicVoucherStructurer } from '@/lib/heuristic-structurer';
import { HttpDocumentDecoder } from '@/lib/http-document-decoder';
import { saveEmailImportCandidate } from '@/lib/import-candidate-repository';
import { emailImportSource, inboundEmailSchema } from '@/lib/inbound-email';
import { VoucherImportPipeline, type DocumentTextProvider } from '@/lib/import-pipeline';
import { requireInboundEmailToken } from '@/lib/job-auth';
import { requireUserId } from '@/lib/request-user';

function textProvider(): DocumentTextProvider {
  const endpoint = process.env.OCR_PROVIDER_URL;
  if (!endpoint) return { async extract() { throw new Error('OCR_PROVIDER_URL ist für Anhänge nicht konfiguriert.'); } };
  return new DecoderTextProvider(new HttpDocumentDecoder(endpoint, process.env.OCR_PROVIDER_TOKEN));
}

export async function POST(request: Request) {
  try {
    requireInboundEmailToken(request);
    const userId = requireUserId(request);
    const email = inboundEmailSchema.parse(await request.json());
    const pipeline = new VoucherImportPipeline(textProvider(), new HeuristicVoucherStructurer());
    const analysis = await pipeline.analyse(emailImportSource(email));
    const candidate = await saveEmailImportCandidate(userId, email, analysis);
    return NextResponse.json({ candidateId: candidate.id, status: candidate.status, reviewRequired: candidate.reviewRequired }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'E-Mail konnte nicht verarbeitet werden.' },
      { status: 400 }
    );
  }
}
