export type RedemptionReadiness = 'READY' | 'READY_WITH_WARNINGS' | 'CONDITIONALLY_READY' | 'NOT_READY' | 'UNKNOWN';
export type CombinationPolicy = 'STACKABLE' | 'EXCLUSIVE' | 'CONDITIONAL' | 'UNKNOWN';

export type RedemptionContext = {
  orderValue?: number;
  channel?: 'ONLINE' | 'STORE' | 'ANY';
  hasPhysicalVoucher?: boolean;
  physicalVoucherAvailable?: boolean;
  membershipVerified?: boolean;
  paymentMethodVerified?: boolean;
};

export type RedemptionRule = {
  minimumOrderValue?: number;
  allowedChannels?: Array<'ONLINE' | 'STORE'>;
  requiresPhysicalVoucher?: boolean;
  requiresMembership?: boolean;
  requiresPaymentMethod?: boolean;
  combinationPolicy?: CombinationPolicy;
};

export type RedemptionAssessment = {
  status: RedemptionReadiness;
  blockingReasons: string[];
  warnings: string[];
  combinationPolicy: CombinationPolicy;
};

export function assessRedemption(rule: RedemptionRule, context: RedemptionContext): RedemptionAssessment {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  if (rule.minimumOrderValue != null && context.orderValue != null && context.orderValue < rule.minimumOrderValue) blockingReasons.push(`Mindestumsatz von ${rule.minimumOrderValue.toFixed(2)} EUR nicht erreicht.`);
  if (rule.minimumOrderValue != null && context.orderValue == null) warnings.push('Bestellwert ist nicht bekannt.');
  if (rule.allowedChannels?.length && context.channel != null && context.channel !== 'ANY' && !rule.allowedChannels.includes(context.channel)) blockingReasons.push('Der gewählte Einlösekanal ist nicht zulässig.');
  if (rule.allowedChannels?.length && context.channel == null) warnings.push('Einlösekanal ist nicht bekannt.');
  if (rule.requiresPhysicalVoucher && context.hasPhysicalVoucher && !context.physicalVoucherAvailable) blockingReasons.push('Das physische Original ist nicht verfügbar.');
  if (rule.requiresPhysicalVoucher && !context.hasPhysicalVoucher) warnings.push('Nicht geklärt, ob das physische Original erforderlich ist.');
  if (rule.requiresMembership && context.membershipVerified !== true) warnings.push('Mitgliedschaft ist noch nicht verifiziert.');
  if (rule.requiresPaymentMethod && context.paymentMethodVerified !== true) warnings.push('Zahlungsbedingung ist noch nicht verifiziert.');
  const status: RedemptionReadiness = blockingReasons.length ? 'NOT_READY' : warnings.length ? (warnings.some(w => w.includes('nicht bekannt') || w.includes('nicht geklärt')) ? 'CONDITIONALLY_READY' : 'READY_WITH_WARNINGS') : 'READY';
  return { status, blockingReasons, warnings, combinationPolicy: rule.combinationPolicy ?? 'UNKNOWN' };
}
