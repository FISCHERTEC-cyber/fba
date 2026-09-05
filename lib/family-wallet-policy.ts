export type FamilyWalletRole = 'OWNER' | 'MEMBER' | 'VIEWER';

export const FAMILY_WALLET_INVITATION_TTL_MS = 7 * 24 * 60 * 60_000;

export function canManageFamilyWallet(role: FamilyWalletRole | undefined) {
  return role === 'OWNER';
}

export function canRedeemFamilyVoucher(role: FamilyWalletRole | undefined) {
  return role === 'OWNER' || role === 'MEMBER';
}

export function canContributeFamilyVoucher(role: FamilyWalletRole | undefined) {
  return role === 'OWNER' || role === 'MEMBER';
}

export function normaliseInvitationEmail(value: string) {
  return value.trim().toLocaleLowerCase('en-US');
}

export function invitationIsUsable(invitation: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}, now = new Date()) {
  return !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt > now;
}
