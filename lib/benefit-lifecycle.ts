export type BenefitLifecycleStatus = 'ACTIVE' | 'RESERVED' | 'REDEEMED' | 'EXPIRED' | 'ARCHIVED' | 'TRANSFER_PENDING';
export type BenefitAction = 'RESERVE' | 'RELEASE_RESERVATION' | 'START_TRANSFER' | 'CANCEL_TRANSFER' | 'REDEEM' | 'EXPIRE' | 'ARCHIVE';

const allowed: Record<BenefitLifecycleStatus, BenefitAction[]> = {
  ACTIVE: ['RESERVE', 'START_TRANSFER', 'REDEEM', 'EXPIRE', 'ARCHIVE'],
  RESERVED: ['RELEASE_RESERVATION', 'REDEEM', 'EXPIRE', 'ARCHIVE'],
  TRANSFER_PENDING: ['CANCEL_TRANSFER', 'EXPIRE', 'ARCHIVE'],
  REDEEMED: ['ARCHIVE'], EXPIRED: ['ARCHIVE'], ARCHIVED: []
};

export function transitionBenefit(status: BenefitLifecycleStatus, action: BenefitAction): BenefitLifecycleStatus {
  if (!allowed[status].includes(action)) throw new Error(`${action} ist im Status ${status} nicht zulässig.`);
  const next: Record<BenefitAction, BenefitLifecycleStatus> = { RESERVE: 'RESERVED', RELEASE_RESERVATION: 'ACTIVE', START_TRANSFER: 'TRANSFER_PENDING', CANCEL_TRANSFER: 'ACTIVE', REDEEM: 'REDEEMED', EXPIRE: 'EXPIRED', ARCHIVE: 'ARCHIVED' };
  return next[action];
}

export function canStartRedemption(status: BenefitLifecycleStatus, actorIsReservationHolder: boolean) {
  return status === 'ACTIVE' || (status === 'RESERVED' && actorIsReservationHolder);
}
