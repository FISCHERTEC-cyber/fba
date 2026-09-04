import { z } from 'zod';

const money = z.number().nonnegative().optional();

export const voucherExtractionSchema = z.object({
  merchantName: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(['VALUE','DISCOUNT','SERVICE','CASHBACK','STORE_CREDIT','LOYALTY']),
  valueAmount: money,
  currency: z.string().length(3).default('EUR'),
  discountPercent: z.number().min(0).max(100).optional(),
  code: z.string().optional(),
  barcode: z.string().optional(),
  qrPayload: z.string().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  minimumOrderValue: money,
  redemptionUrl: z.string().url().optional(),
  terms: z.string().optional(),
  physicalVoucher: z.boolean().default(false),
  storageLocation: z.string().optional(),
  eventMonitoringEnabled: z.boolean().default(false),
  sourceType: z.enum(['PHOTO','PDF','SCREENSHOT','EMAIL','MANUAL','WALLET']),
  sourceReference: z.string().optional(),
  confidence: z.object({
    overall: z.number().min(0).max(1),
    fields: z.record(z.number().min(0).max(1)).default({})
  })
});

export type VoucherExtraction = z.infer<typeof voucherExtractionSchema>;

export type ReviewFlag = { field: string; confidence: number; reason: string };

export function reviewFlags(extraction: VoucherExtraction, threshold = 0.82): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  for (const [field, confidence] of Object.entries(extraction.confidence.fields)) {
    if (confidence < threshold) {
      flags.push({ field, confidence, reason: `Confidence ${Math.round(confidence * 100)} % liegt unter ${Math.round(threshold * 100)} %` });
    }
  }
  if (extraction.confidence.overall < threshold) {
    flags.unshift({ field: '_overall', confidence: extraction.confidence.overall, reason: 'Gesamterkennung muss bestätigt werden' });
  }
  return flags;
}

export function normaliseExtraction(input: unknown): VoucherExtraction {
  const parsed = voucherExtractionSchema.parse(input);
  return {
    ...parsed,
    merchantName: parsed.merchantName.trim(),
    title: parsed.title.trim(),
    code: parsed.code?.trim() || undefined,
    storageLocation: parsed.storageLocation?.trim() || undefined,
    terms: parsed.terms?.trim() || undefined
  };
}
