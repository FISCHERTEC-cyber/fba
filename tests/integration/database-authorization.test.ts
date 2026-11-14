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
} from '../../lib/family-wallet-repository';
import { createUserSession, resolveSessionUser, revokeSession, revokeUserDevice } from '../../lib/session-service';
import { tokenHash } from '../../lib/session-security';
import { getVoucherDetail } from '../../lib/voucher-repository';
import { GET as getVoucherRoute } from '../../app/api/vouchers/[id]/route';
import { POST as assignVoucherRoute } from '../../app/api/wallets/[id]/vouchers/route';

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

test('foreign voucher cannot be read or assigned to another user wallet', async () => {
  const owner = await prisma.user.create({data:{email:`object-owner-${suffix}@example.invalid`}});
  const outsider = await prisma.user.create({data:{email:`object-outsider-${suffix}@example.invalid`}});
  const voucher = await prisma.voucher.create({data:{
    userId: owner.id, merchantName:'CI fixture', title:'Private voucher', kind:'VALUE',
  }});
  const foreignWallet = await createFamilyWallet(outsider.id, 'Outsider wallet');
  assert.equal((await getVoucherDetail(owner.id, voucher.id)).id, voucher.id);
  await assert.rejects(getVoucherDetail(outsider.id, voucher.id), /nicht gefunden/);
  await assert.rejects(assignVoucherToFamilyWallet(outsider.id, foreignWallet.id, voucher.id),
    /Nur eigene Gutscheine/);
  assert.equal((await prisma.voucher.findUniqueOrThrow({where:{id:voucher.id}})).walletId, null);
});

test('database transaction rolls back writes after an exception', async () => {
  const email = `rollback-${suffix}@example.invalid`;
  await assert.rejects(prisma.$transaction(async tx => {
    await tx.user.create({data:{email}});
    throw new Error('forced rollback');
  }), /forced rollback/);
  assert.equal(await prisma.user.count({where:{email}}), 0);
});

test('API routes enforce session and owner access before returning or changing voucher data', async () => {
  const owner = await createUserSession({supabaseUserId:`route-owner-${suffix}`,
    email:`route-owner-${suffix}@example.invalid`});
  const outsider = await createUserSession({supabaseUserId:`route-outsider-${suffix}`,
    email:`route-outsider-${suffix}@example.invalid`});
  const voucher = await prisma.voucher.create({data:{
    userId:owner.userId, merchantName:'CI fixture', title:'owner-only fixture', kind:'VALUE',
  }});
  const wallet = await createFamilyWallet(outsider.userId, 'Foreign wallet');
  const cookie = (token: string) => ({cookie:`fba_session=${token}`});
  const context = {params:Promise.resolve({id:voucher.id})};
  const request = (headers?: Record<string,string>) =>
    new Request('https://fba.example.test/api/vouchers/test', {headers});
  const ownerResponse = await getVoucherRoute(request(cookie(owner.sessionToken)), context);
  assert.equal(ownerResponse.status, 200);
  assert.equal((await ownerResponse.json()).voucher.id, voucher.id);
  const unauthenticated = await getVoucherRoute(request(), context);
  assert.notEqual(unauthenticated.status, 200);
  const foreignResponse = await getVoucherRoute(request(cookie(outsider.sessionToken)), context);
  assert.notEqual(foreignResponse.status, 200);
  assert.equal((await foreignResponse.text()).includes('owner-only fixture'), false);
  const assignResponse = await assignVoucherRoute(new Request('https://fba.example.test/api/wallets/test/vouchers', {
    method:'POST', headers:{...cookie(outsider.sessionToken), 'content-type':'application/json'},
    body:JSON.stringify({voucherId:voucher.id}),
  }), {params:Promise.resolve({id:wallet.id})});
  assert.notEqual(assignResponse.status, 200);
  assert.equal((await prisma.voucher.findUniqueOrThrow({where:{id:voucher.id}})).walletId, null);
  await revokeSession(owner.sessionToken);
  const revoked = await getVoucherRoute(request(cookie(owner.sessionToken)), context);
  assert.notEqual(revoked.status, 200);
});

test('a different Supabase subject cannot claim an already linked email', async () => {
  const email = `subject-conflict-${suffix}@example.invalid`;
  const original = await createUserSession({supabaseUserId:`subject-one-${suffix}`, email});
  await assert.rejects(
    createUserSession({supabaseUserId:`subject-two-${suffix}`, email}),
    /Identität|Identitaet/,
  );
  const user = await prisma.user.findUniqueOrThrow({where:{id:original.userId}});
  assert.equal(user.supabaseUserId, `subject-one-${suffix}`);
  assert.equal(await resolveSessionUser(original.sessionToken), original.userId);
});


test('unverified legacy account cannot be linked even by parallel subjects', async () => {
  const email = `legacy-${suffix}@example.invalid`;
  const old = await prisma.user.create({data:{email}});
  const attempts = await Promise.allSettled([
    createUserSession({supabaseUserId:`legacy-a-${suffix}`, email}),
    createUserSession({supabaseUserId:`legacy-b-${suffix}`, email}),
  ]);
  assert.equal(attempts.every(result => result.status === 'rejected'), true);
  const unchanged = await prisma.user.findUniqueOrThrow({where:{id:old.id}});
  assert.equal(unchanged.supabaseUserId, null);
  assert.equal(await prisma.userSession.count({where:{userId:old.id}}), 0);
});

test('stable subject retains the same account after email change', async () => {
  const subject = `stable-subject-${suffix}`;
  const first = await createUserSession({supabaseUserId:subject, email:`old-${suffix}@example.invalid`});
  await revokeSession(first.sessionToken);
  const changedEmail = `changed-${suffix}@example.invalid`;
  const second = await createUserSession({supabaseUserId:subject, email:changedEmail});
  assert.equal(second.userId, first.userId);
  assert.equal((await prisma.user.findUniqueOrThrow({where:{id:first.userId}})).email, changedEmail);
});

test('concurrent revocation commits before blocked renewal and prevents authorization', async () => {
  const session = await createUserSession({supabaseUserId:`race-${suffix}`, email:`race-${suffix}@example.invalid`});
  let release!: () => void;
  let locked!: () => void;
  const acquired = new Promise<void>(r => { locked = r; });
  const gate = new Promise<void>(r => { release = r; });
  const revocation = prisma.$transaction(async tx => {
    await tx.userSession.updateMany({where:{tokenHash:tokenHash(session.sessionToken),revokedAt:null},
      data:{revokedAt:new Date()}});
    locked();
    await gate;
  }, {timeout:10000});
  await acquired;
  const resolution = resolveSessionUser(session.sessionToken).then(
    value => ({ok:true as const,value}), error => ({ok:false as const,error})
  );
  release();
  await revocation;
  const outcome = await resolution;
  assert.equal(outcome.ok, false);
  await assert.rejects(resolveSessionUser(session.sessionToken), /Anmeldung erforderlich/);
});

test('concurrent renewal and device revocation cannot revive a revoked device', async () => {
  const session = await createUserSession({supabaseUserId:`device-${suffix}`, email:`device-${suffix}@example.invalid`});
  const device = await prisma.userDevice.findFirstOrThrow({where:{userId:session.userId}});
  const results = await Promise.allSettled([
    resolveSessionUser(session.sessionToken), resolveSessionUser(session.sessionToken),
    revokeUserDevice(session.userId, device.id),
  ]);
  assert.equal(results[2].status, 'fulfilled');
  await assert.rejects(resolveSessionUser(session.sessionToken), /Anmeldung erforderlich/);
  const saved = await prisma.userSession.findUniqueOrThrow({where:{tokenHash:tokenHash(session.sessionToken)}});
  assert.notEqual(saved.revokedAt, null);
});

test('renewal waiting for a session lock rejects an expiry committed while waiting', async () => {
  const session = await createUserSession({supabaseUserId:`expiry-race-${suffix}`, email:`expiry-race-${suffix}@example.invalid`});
  let release!: () => void;
  let locked!: () => void;
  const acquired = new Promise<void>(r => { locked = r; });
  const gate = new Promise<void>(r => { release = r; });
  const expire = prisma.$transaction(async tx => {
    await tx.userSession.updateMany({where:{tokenHash:tokenHash(session.sessionToken)},
      data:{expiresAt:new Date(Date.now() - 60000)}});
    locked();
    await gate;
  }, {timeout:10000});
  await acquired;
  const resolution = resolveSessionUser(session.sessionToken).then(
    value => ({ok:true as const,value}), error => ({ok:false as const,error})
  );
  release();
  await expire;
  const outcome = await resolution;
  assert.equal(outcome.ok, false);
});
