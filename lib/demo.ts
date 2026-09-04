import type { Voucher, Opportunity } from './types';
import { redemptionScore } from './scoring';

export const vouchers: Voucher[] = [
  {
    id:'v1', merchantName:'Gasthaus Adler', title:'Restaurant-Gutschein', kind:'VALUE',
    valueAmount:100, currency:'EUR', validUntil:'2026-11-30', physicalVoucher:true,
    storageLocation:'Auto → Handschuhfach → rechte Dokumententasche', status:'ACTIVE',
    eventMonitoringEnabled:true, extractionConfidence:0.97, createdAt:'2026-09-04T16:00:00Z'
  },
  {
    id:'v2', merchantName:'Sporthaus Beispiel', title:'Aktionsgutschein', kind:'DISCOUNT',
    discountPercent:20, validUntil:'2026-09-20', physicalVoucher:false, status:'ACTIVE',
    eventMonitoringEnabled:false, extractionConfidence:0.92, createdAt:'2026-09-04T16:00:00Z'
  }
];

export const opportunities: Opportunity[] = [
  {
    id:'o1', voucherId:'v1', merchantName:'Gasthaus Adler', title:'Wildwochen',
    startsAt:'2026-10-10', endsAt:'2026-10-25', distanceKm:18,
    relevanceScore: redemptionScore(vouchers[0], {title:'Wildwochen',distanceKm:18}),
    reason:['100 € Gutschein vorhanden','Event beim Gutscheinanbieter','nur 18 km entfernt']
  }
];
