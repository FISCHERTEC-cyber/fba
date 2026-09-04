import { NextResponse } from 'next/server';
import { VoucherImportPipeline, type DocumentTextProvider } from '@/lib/import-pipeline';
import { DecoderTextProvider } from '@/lib/binary-import';
import { HttpDocumentDecoder } from '@/lib/http-document-decoder';
import { HeuristicVoucherStructurer } from '@/lib/heuristic-structurer';

function createTextProvider(): DocumentTextProvider {
  const endpoint = process.env.OCR_PROVIDER_URL;
  if (!endpoint) {
    return {
      async extract() {
        throw new Error('Für Binärdateien ist OCR_PROVIDER_URL noch nicht konfiguriert.');
      }
    };
  }
  return new DecoderTextProvider(new HttpDocumentDecoder(endpoint, process.env.OCR_PROVIDER_TOKEN));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pipeline = new VoucherImportPipeline(createTextProvider(), new HeuristicVoucherStructurer());
    const result = await pipeline.analyse(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Importanalyse fehlgeschlagen' },
      { status: 400 }
    );
  }
}
