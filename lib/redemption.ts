export type RedeemableVoucher = {
  kind: string;
  status: string;
  valueAmount: number | null;
  redeemedAmount: number;
};

export type RedemptionDecision = {
  amount: number | null;
  remainingAmount: number | null;
  markRedeemed: boolean;
};

const MONEY_KINDS = new Set(['VALUE', 'STORE_CREDIT', 'CASHBACK']);

export function decideRedemption(
  voucher: RedeemableVoucher,
  requestedAmount?: number,
  redeemCompletely = false
): RedemptionDecision {
  if (voucher.status !== 'ACTIVE') throw new Error('Nur aktive Vorteile können eingelöst werden.');

  if (!MONEY_KINDS.has(voucher.kind) || voucher.valueAmount === null) {
    if (requestedAmount !== undefined) throw new Error('Für diesen Vorteil ist kein Teilbetrag vorgesehen.');
    return { amount: null, remainingAmount: null, markRedeemed: true };
  }

  const remaining = cents(voucher.valueAmount - voucher.redeemedAmount);
  if (remaining <= 0) throw new Error('Der Gutschein hat kein Restguthaben.');

  const amount = redeemCompletely ? remaining : requestedAmount;
  if (amount === undefined) throw new Error('Einlösebetrag fehlt.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Der Einlösebetrag muss größer als 0 sein.');

  const normalisedAmount = cents(amount);
  if (normalisedAmount > remaining) {
    throw new Error(`Der Einlösebetrag überschreitet das Restguthaben von ${remaining.toFixed(2)} EUR.`);
  }

  const remainingAmount = cents(remaining - normalisedAmount);
  return {
    amount: normalisedAmount,
    remainingAmount,
    markRedeemed: remainingAmount === 0
  };
}

function cents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
