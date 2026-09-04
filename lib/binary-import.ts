import type { DocumentTextProvider, ImportSource, TextExtractionResult } from './import-pipeline';

export interface BinaryDocumentInput extends ImportSource {
  base64Data: string;
}

export interface BinaryDecoderResult extends TextExtractionResult {
  barcodes?: Array<{ format: string; value: string; confidence?: number }>;
}

export interface BinaryDocumentDecoder {
  decode(source: BinaryDocumentInput): Promise<BinaryDecoderResult>;
}

export class DecoderTextProvider implements DocumentTextProvider {
  constructor(private readonly decoder: BinaryDocumentDecoder) {}

  async extract(source: ImportSource): Promise<TextExtractionResult> {
    const binary = source as Partial<BinaryDocumentInput>;
    if (!binary.base64Data) throw new Error('Binärquelle benötigt base64Data.');
    const decoded = await this.decoder.decode(source as BinaryDocumentInput);
    return { text: decoded.text, provider: decoded.provider, confidence: decoded.confidence };
  }
}

export function barcodeHints(result: BinaryDecoderResult) {
  const hints: { code?: string; qrPayload?: string; barcode?: string } = {};
  for (const item of result.barcodes ?? []) {
    const format = item.format.toUpperCase();
    if (format.includes('QR') && !hints.qrPayload) hints.qrPayload = item.value;
    else if (!hints.barcode) hints.barcode = item.value;
  }
  return hints;
}
