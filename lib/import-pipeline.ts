import { normaliseExtraction, reviewFlags, type VoucherExtraction } from './extraction';

export type ImportSourceType = 'PHOTO'|'PDF'|'SCREENSHOT'|'EMAIL'|'MANUAL'|'WALLET';

export interface ImportSource {
  sourceType: ImportSourceType;
  fileName?: string;
  mimeType?: string;
  sourceReference?: string;
  rawText?: string;
}

export interface TextExtractionResult {
  text: string;
  provider: string;
  confidence: number;
}

export interface DocumentTextProvider {
  extract(source: ImportSource): Promise<TextExtractionResult>;
}

export interface VoucherStructuringProvider {
  structure(text: string, source: ImportSource): Promise<unknown>;
}

export interface ImportAnalysis {
  extraction: VoucherExtraction;
  reviewRequired: boolean;
  reviewFlags: ReturnType<typeof reviewFlags>;
  provenance: {
    textProvider: string;
    textConfidence: number;
    sourceType: ImportSourceType;
    fileName?: string;
  };
}

export class VoucherImportPipeline {
  constructor(
    private readonly textProvider: DocumentTextProvider,
    private readonly structuringProvider: VoucherStructuringProvider,
    private readonly reviewThreshold = 0.82
  ) {}

  async analyse(source: ImportSource): Promise<ImportAnalysis> {
    validateSource(source);
    const textResult = source.rawText?.trim()
      ? { text: source.rawText.trim(), provider: 'supplied-text', confidence: 1 }
      : await this.textProvider.extract(source);

    if (!textResult.text.trim()) throw new Error('Aus dem Dokument konnte kein Text extrahiert werden.');

    const structured = await this.structuringProvider.structure(textResult.text, source);
    const extraction = normaliseExtraction(structured);
    const flags = reviewFlags(extraction, this.reviewThreshold);

    if (textResult.confidence < this.reviewThreshold) {
      flags.unshift({
        field: '_source_text',
        confidence: textResult.confidence,
        reason: `Dokumenterkennung ${Math.round(textResult.confidence * 100)} % liegt unter ${Math.round(this.reviewThreshold * 100)} %`
      });
    }

    return {
      extraction,
      reviewRequired: flags.length > 0,
      reviewFlags: flags,
      provenance: {
        textProvider: textResult.provider,
        textConfidence: textResult.confidence,
        sourceType: source.sourceType,
        fileName: source.fileName
      }
    };
  }
}

export function validateSource(source: ImportSource) {
  const allowedMime = new Set(['image/jpeg','image/png','image/webp','application/pdf','message/rfc822','text/plain']);
  if (!source.rawText && !source.sourceReference) {
    throw new Error('Quelle benötigt rawText oder sourceReference.');
  }
  if (source.mimeType && !allowedMime.has(source.mimeType)) {
    throw new Error(`Nicht unterstützter Dateityp: ${source.mimeType}`);
  }
}
