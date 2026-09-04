import type { BinaryDocumentDecoder, BinaryDocumentInput, BinaryDecoderResult } from './binary-import';

export class HttpDocumentDecoder implements BinaryDocumentDecoder {
  constructor(
    private readonly endpoint: string,
    private readonly token?: string
  ) {}

  async decode(source: BinaryDocumentInput): Promise<BinaryDecoderResult> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
      },
      body: JSON.stringify({
        fileName: source.fileName,
        mimeType: source.mimeType,
        base64Data: source.base64Data,
        features: ['text', 'qr', 'barcode']
      }),
      cache: 'no-store'
    });

    if (!response.ok) throw new Error(`Dokumentdecoder antwortet mit HTTP ${response.status}.`);
    const data = await response.json() as Partial<BinaryDecoderResult>;
    if (!data.text || typeof data.text !== 'string') throw new Error('Dokumentdecoder lieferte keinen Text.');

    return {
      text: data.text,
      provider: data.provider ?? 'http-document-decoder',
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
      barcodes: Array.isArray(data.barcodes) ? data.barcodes : []
    };
  }
}
