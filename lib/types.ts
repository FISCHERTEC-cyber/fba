export type VoucherKind = 'VALUE'|'DISCOUNT'|'SERVICE'|'CASHBACK'|'STORE_CREDIT'|'LOYALTY';
export type VoucherStatus = 'ACTIVE'|'REDEEMED'|'EXPIRED'|'ARCHIVED';

export interface Voucher {
  id: string;
  merchantName: string;
  title: string;
  kind: VoucherKind;
  valueAmount?: number;
  currency?: string;
  discountPercent?: number;
  code?: string;
  validUntil?: string;
  minimumOrderValue?: number;
  redemptionUrl?: string;
  physicalVoucher: boolean;
  storageLocation?: string;
  storageLocationPhotoUrl?: string;
  status: VoucherStatus;
  eventMonitoringEnabled: boolean;
  extractionConfidence?: number;
  createdAt: string;
}

export interface Opportunity {
  id: string;
  voucherId: string;
  merchantName: string;
  title: string;
  startsAt?: string;
  endsAt?: string;
  sourceUrl?: string;
  distanceKm?: number;
  relevanceScore: number;
  reason: string[];
}
