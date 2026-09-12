import type { ImportSource, VoucherStructuringProvider } from './import-pipeline';

function isoDateFromGerman(text: string) {
  const germanMatch = text.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/);
  const isoMatch = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (!germanMatch && !isoMatch) return undefined;
  const [, first, second, third] = germanMatch ?? isoMatch!;
  const [d, m, y] = germanMatch ? [first, second, third] : [third, second, first];
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export class HeuristicVoucherStructurer implements VoucherStructuringProvider {
  async structure(text: string, source: ImportSource) {
    const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const merchantName = lines[0]?.slice(0, 100) || 'Unbekannter Anbieter';
    const amountMatch = text.match(/(?:€\s*(\d{1,4}(?:[.,]\d{1,2})?)\b)|(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|EUR)\b/i);
    const percentMatch = text.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*%/);
    const codeMatch = text.match(/(?:code|gutscheincode|coupon|voucher\s*(?:code|nr\.?))\s*[:#-]?\s*([A-Z0-9][A-Z0-9_-]{3,63})/i);
    const urlMatch = text.match(/https?:\/\/[^\s)]+/i);
    const validUntil = isoDateFromGerman(text);
    const valueAmount = amountMatch ? Number((amountMatch[1] ?? amountMatch[2]).replace(',', '.')) : undefined;
    const discountPercent = percentMatch ? Number(percentMatch[1].replace(',', '.')) : undefined;
    const kind = discountPercent != null ? 'DISCOUNT' : valueAmount != null ? 'VALUE' : 'SERVICE';

    const fields: Record<string, number> = {
      merchantName: lines[0] ? 0.72 : 0.2,
      title: 0.75,
      kind: valueAmount != null || discountPercent != null ? 0.88 : 0.55,
      validUntil: validUntil ? 0.86 : 0.25,
      code: codeMatch ? 0.92 : 0.25,
      valueAmount: valueAmount != null ? 0.9 : 0.25
    };
    if (discountPercent != null) fields.discountPercent = 0.9;
    if (codeMatch) fields.code = 0.92;
    if (urlMatch) fields.redemptionUrl = 0.96;

    const confidenceValues = Object.values(fields);
    const overall = confidenceValues.reduce((a,b) => a+b, 0) / confidenceValues.length;

    return {
      merchantName,
      title: lines.find(l => /gutschein|voucher|coupon|rabatt/i.test(l))?.slice(0, 120) || 'Gutschein',
      kind,
      valueAmount,
      currency: 'EUR',
      discountPercent,
      code: codeMatch?.[1],
      validUntil,
      redemptionUrl: urlMatch?.[0],
      terms: lines.slice(1).join(' ').slice(0, 1200) || undefined,
      physicalVoucher: source.sourceType === 'PHOTO',
      eventMonitoringEnabled: false,
      sourceType: source.sourceType,
      sourceReference: source.sourceReference,
      confidence: { overall, fields }
    };
  }
}
