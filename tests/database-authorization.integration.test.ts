/** Real PostgreSQL/Prisma security integration. Never run against an existing DB. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import {
  acceptFamilyWalletInvitation,
  assignVoucherToFamilyWallet,
  createFamilyWallet,
  createFamilyWalletInvitation,
  listFamilyWallets,
} from '../lib/family-wallet-repository';
import { createUserSession, resolveSessionUser, revokeSession } from '../lib/session-service';

const url = process.env.DATABASE_URL || '';
if (!url.includes('localhost:5432/fba_ci_isolated')) {
  throw new Error('Refusing database integration test outside isolated CI PostgreSQL database');
}
const prisma = new PrismaClient();
const suffix = `${process.pid}-${Date.now()}`;

test('isolated PostgreSQL: owner and foreign-user permissions, invitation rollback', async () => {
  const [owner, invited, outsider] = await Promise.all([
    prisma.user.create({data:{email:`fba-owner-${suffix}@example.invalid`}}),
    prisma.user.create({data:{email:`fba-invited-${suffix}@example.invalid`}}),
    prisma.user.create({data:{email:`fba-outsider-${suffix}@example.invalid`}}),
  ]);
  try {
    const wallet = await createFamilyWallet(owner.id, 'CI Testwallet');
    const [owned, foreign] = await Promise.all([
      listFamilyWallets(owner.id), listFamilyWallets(invited.id),
    ]);
    assert.equal(owned.some(w => w.id === wallet.id), true);
    assert.equal(foreign.some(w => w.id === wallet.id), false,
      'Foreign users must not see owner wallets before invitation');

    const before = await prisma.familyWalletInvitation.count({where:{walletId:wallet.id}});
    await assert.rejects(
      createFamilyWalletInvitation({
        userId: outsider.id, walletId: wallet.id, email: invited.email, role:'VIEWER',
      }),
      /Kein Zugriff|Wallet-Eigentümer/,
    );
    assert.equal(await prisma.familyWalletInvitation.count({where:{walletId:wallet.id}}), before,
      'Rejected foreign-owner write must leave no invitation');

    const invitation = await createFamilyWalletInvitation({
      userId: owner.id, walletId:wallet.id, email:invited.email, role:'VIEWER',
    });
    await assert.rejects(
      acceptFamilyWalletInvitation(outsider.id, invitation.token),
      /andere E-Mail-Adresse/,
    );
    assert.equal(await prisma.familyWalletMember.count({
      where:{walletId:wallet.id, userId:outsider.id},
    }), 0, 'Foreign invitation attempt must roll back');

    await acceptFamilyWalletInvitation(invited.id, invitation.token);
    const memberWallets = await listFamilyWallets(invited.id);
    assert.equal(memberWallets.some(w => w.id === wallet.id && w.role === 'VIEWER'), true);
    await assert.rejects(
      assignVoucherToFamilyWallet(invited.id, wallet.id, 'nonexistent-voucher'),
      /Leserecht/,
      'A viewer must not be allowed to contribute',
    );
  } finally {
    await prisma.$disconnect();
  }
});

test('isolated PostgreSQL: session cannot be reused after revocation or expiry', async () => {
  const email = `fba-session-${suffix}@example.invalid`;
  const subject = `ci-subject-${suffix}`;
  const at = new Date('2026-11-13T12:00:00Z');
  const session = await createUserSession({
    supabaseUserId: subject, email, deviceName:'CI test device', now:at,
  });
  assert.equal(await resolveSessionUser(session.sessionToken, new Date(at.getTime()+1000)),
    session.userId);
  await revokeSession(session.sessionToken, new Date(at.getTime()+2000));
  await assert.rejects(
    resolveSessionUser(session.sessionToken, new Date(at.getTime()+3000)),
    /Anmeldung erforderlich/,
  );
  const fresh = await createUserSession({
    supabaseUserId: subject, email, deviceToken: session.deviceToken,
    deviceName:'CI test device', now:new Date(at.getTime()+4000),
  });
  await assert.rejects(
    resolveSessionUser(fresh.sessionToken, new Date(fresh.expiresAt.getTime()+1)),
    /Anmeldung erforderlich/,
  );
});
