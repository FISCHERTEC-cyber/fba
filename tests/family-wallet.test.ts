import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canManageFamilyWallet,
  canContributeFamilyVoucher,
  canRedeemFamilyVoucher,
  FAMILY_WALLET_INVITATION_TTL_MS,
  invitationIsUsable,
  normaliseInvitationEmail
} from '../lib/family-wallet-policy.ts';

test('family wallet roles separate management, redemption and read access', () => {
  assert.equal(canManageFamilyWallet('OWNER'), true);
  assert.equal(canManageFamilyWallet('MEMBER'), false);
  assert.equal(canRedeemFamilyVoucher('OWNER'), true);
  assert.equal(canRedeemFamilyVoucher('MEMBER'), true);
  assert.equal(canRedeemFamilyVoucher('VIEWER'), false);
  assert.equal(canContributeFamilyVoucher('MEMBER'), true);
  assert.equal(canContributeFamilyVoucher('VIEWER'), false);
});

test('family wallet invitation addresses are normalised', () => {
  assert.equal(normaliseInvitationEmail(' Frank.Fischer@Example.DE '), 'frank.fischer@example.de');
  assert.equal(FAMILY_WALLET_INVITATION_TTL_MS, 7 * 24 * 60 * 60_000);
});

test('only pending, unrevoked and unexpired invitations are usable', () => {
  const now = new Date('2026-09-05T12:00:00.000Z');
  assert.equal(invitationIsUsable({ acceptedAt: null, revokedAt: null, expiresAt: new Date('2026-09-05T12:00:01.000Z') }, now), true);
  assert.equal(invitationIsUsable({ acceptedAt: now, revokedAt: null, expiresAt: new Date('2026-09-06T12:00:00.000Z') }, now), false);
  assert.equal(invitationIsUsable({ acceptedAt: null, revokedAt: now, expiresAt: new Date('2026-09-06T12:00:00.000Z') }, now), false);
  assert.equal(invitationIsUsable({ acceptedAt: null, revokedAt: null, expiresAt: now }, now), false);
});
