import type { Voucher, Opportunity } from './types';

export function redemptionScore(voucher: Voucher, opportunity?: Partial<Opportunity>, now = new Date()): number {
  let score = 0;
  if (voucher.validUntil) {
    const days = Math.ceil((new Date(voucher.validUntil).getTime() - now.getTime()) / 86400000);
    if (days <= 7) score += 40;
    else if (days <= 30) score += 25;
    else if (days <= 90) score += 10;
  }
  if ((voucher.valueAmount ?? 0) >= 100) score += 20;
  else if ((voucher.valueAmount ?? 0) >= 50) score += 12;
  else if ((voucher.valueAmount ?? 0) > 0) score += 6;
  if (opportunity?.title) score += 20;
  if (opportunity?.distanceKm != null) {
    if (opportunity.distanceKm <= 10) score += 12;
    else if (opportunity.distanceKm <= 30) score += 8;
    else if (opportunity.distanceKm <= 80) score += 3;
  }
  if (voucher.physicalVoucher && voucher.storageLocation) score += 3;
  return Math.max(0, Math.min(100, score));
}
