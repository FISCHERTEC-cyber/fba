import { NextResponse } from 'next/server';
import { VoucherImportPipeline, type DocumentTextProvider } from '@/lib/import-pipeline';
import { HeuristicVoucherStructurer } from '@/lib/heuristic-structurer';

const textProvider: DocumentTextProvider = {
  async extract() {
    throw new Error('Für Binärdateien ist noch kein OCR-Provider konfiguriert.');
  }
};

const pipeline = new VoucherImportPipeline(textProvider, new HeuristicVoucherStructurer());

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await pipeline.analyse(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Importanalyse fehlgeschlagen' },
      { status: 400 }
    );
  }
}
