import { Prisma, type FamilyWalletRole } from '@prisma/client';
import { prisma } from './prisma';
import { newOpaqueToken, tokenHash } from './session-security';
import {
  canContributeFamilyVoucher,
  FAMILY_WALLET_INVITATION_TTL_MS,
  invitationIsUsable,
  normaliseInvitationEmail
} from './family-wallet-policy';

export async function listFamilyWallets(userId: string) {
  const memberships = await prisma.familyWalletMember.findMany({
    where: { userId },
    include: {
      wallet: {
        include: {
          members: {
            include: { user: { select: { id: true, email: true } } },
            orderBy: { joinedAt: 'asc' }
          },
          _count: { select: { vouchers: { where: { status: 'ACTIVE' } } } }
        }
      }
    },
    orderBy: { joinedAt: 'asc' }
  });
  const ownedWalletIds = memberships.filter(item => item.role === 'OWNER').map(item => item.walletId);
  const pendingInvitations = ownedWalletIds.length ? await prisma.familyWalletInvitation.findMany({
    where: {
      walletId: { in: ownedWalletIds },
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    select: { id: true, walletId: true, email: true, role: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  }) : [];

  return memberships.map(membership => ({
    id: membership.wallet.id,
    name: membership.wallet.name,
    role: membership.role,
    voucherCount: membership.wallet._count.vouchers,
    members: membership.wallet.members.map(member => ({
      userId: member.userId,
      email: member.user.email,
      role: member.role,
      joinedAt: member.joinedAt
    })),
    pendingInvitations: pendingInvitations.filter(invitation => invitation.walletId === membership.walletId),
    createdAt: membership.wallet.createdAt
  }));
}

export async function createFamilyWallet(userId: string, name: string) {
  const walletName = name.trim();
  if (walletName.length < 2 || walletName.length > 80) {
    throw new Error('Der Wallet-Name muss 2 bis 80 Zeichen lang sein.');
  }
  return prisma.familyWallet.create({
    data: {
      name: walletName,
      createdByUserId: userId,
      members: { create: { userId, role: 'OWNER' } }
    },
    select: { id: true, name: true, createdAt: true }
  });
}

export async function createFamilyWalletInvitation(input: {
  userId: string;
  walletId: string;
  email: string;
  role: Exclude<FamilyWalletRole, 'OWNER'>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const email = normaliseInvitationEmail(input.email);
  const invitationToken = newOpaqueToken();
  if (!email || !email.includes('@')) throw new Error('Eine gültige E-Mail-Adresse ist erforderlich.');
  if (input.role !== 'MEMBER' && input.role !== 'VIEWER') throw new Error('Ungültige Wallet-Rolle.');

  const invitation = await prisma.$transaction(async transaction => {
    await requireWalletOwner(transaction, input.userId, input.walletId);
    const existingUser = await transaction.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      const existingMember = await transaction.familyWalletMember.findUnique({
        where: { walletId_userId: { walletId: input.walletId, userId: existingUser.id } }
      });
      if (existingMember) throw new Error('Diese Person ist bereits Mitglied der Wallet.');
    }
    await transaction.familyWalletInvitation.updateMany({
      where: { walletId: input.walletId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now }
    });
    return transaction.familyWalletInvitation.create({
      data: {
        walletId: input.walletId,
        email,
        role: input.role,
        tokenHash: tokenHash(invitationToken),
        invitedByUserId: input.userId,
        expiresAt: new Date(now.getTime() + FAMILY_WALLET_INVITATION_TTL_MS)
      },
      select: { id: true, email: true, role: true, expiresAt: true }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return { ...invitation, token: invitationToken };
}

export async function acceptFamilyWalletInvitation(userId: string, invitationToken: string, now = new Date()) {
  const cleanToken = invitationToken.trim();
  if (cleanToken.length < 32) throw new Error('Einladungscode ist ungültig.');
  return prisma.$transaction(async transaction => {
    const invitation = await transaction.familyWalletInvitation.findUnique({
      where: { tokenHash: tokenHash(cleanToken) },
      include: { wallet: { select: { id: true, name: true } } }
    });
    if (!invitation || !invitationIsUsable(invitation, now)) {
      throw new Error('Einladung ist ungültig, abgelaufen oder wurde bereits verwendet.');
    }
    const user = await transaction.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    if (normaliseInvitationEmail(user.email) !== normaliseInvitationEmail(invitation.email)) {
      throw new Error('Die Einladung wurde für eine andere E-Mail-Adresse erstellt.');
    }
    const existing = await transaction.familyWalletMember.findUnique({
      where: { walletId_userId: { walletId: invitation.walletId, userId } }
    });
    const role = strongerRole(existing?.role, invitation.role);
    await transaction.familyWalletMember.upsert({
      where: { walletId_userId: { walletId: invitation.walletId, userId } },
      create: { walletId: invitation.walletId, userId, role },
      update: { role }
    });
    await transaction.familyWalletInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: now, acceptedByUserId: userId }
    });
    return { wallet: invitation.wallet, role };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function assignVoucherToFamilyWallet(userId: string, walletId: string, voucherId: string) {
  return prisma.$transaction(async transaction => {
    await requireWalletContributor(transaction, userId, walletId);
    const voucher = await transaction.voucher.findFirst({ where: { id: voucherId, userId } });
    if (!voucher) throw new Error('Nur eigene Gutscheine können freigegeben werden.');
    return transaction.voucher.update({
      where: { id: voucher.id },
      data: { walletId },
      select: { id: true, walletId: true }
    });
  });
}

export async function removeVoucherFromFamilyWallet(userId: string, walletId: string, voucherId: string) {
  return prisma.$transaction(async transaction => {
    const membership = await requireWalletMembership(transaction, userId, walletId);
    const result = await transaction.voucher.updateMany({
      where: {
        id: voucherId,
        walletId,
        ...(membership.role === 'OWNER' ? {} : { userId })
      },
      data: { walletId: null }
    });
    if (!result.count) throw new Error('Freigegebener Gutschein wurde nicht gefunden.');
  });
}

export async function removeFamilyWalletMember(userId: string, walletId: string, memberUserId: string) {
  return prisma.$transaction(async transaction => {
    await requireWalletOwner(transaction, userId, walletId);
    const member = await transaction.familyWalletMember.findUnique({
      where: { walletId_userId: { walletId, userId: memberUserId } }
    });
    if (!member) throw new Error('Wallet-Mitglied wurde nicht gefunden.');
    if (member.role === 'OWNER') throw new Error('Der Eigentümer kann nicht entfernt werden.');
    await transaction.voucher.updateMany({
      where: { walletId, userId: memberUserId },
      data: { walletId: null }
    });
    await transaction.familyWalletMember.delete({
      where: { walletId_userId: { walletId, userId: memberUserId } }
    });
  });
}

export async function revokeFamilyWalletInvitation(userId: string, walletId: string, invitationId: string, now = new Date()) {
  return prisma.$transaction(async transaction => {
    await requireWalletOwner(transaction, userId, walletId);
    const result = await transaction.familyWalletInvitation.updateMany({
      where: { id: invitationId, walletId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now }
    });
    if (!result.count) throw new Error('Offene Einladung wurde nicht gefunden.');
  });
}

type WalletTransaction = Prisma.TransactionClient;

async function requireWalletOwner(transaction: WalletTransaction, userId: string, walletId: string) {
  const membership = await requireWalletMembership(transaction, userId, walletId);
  if (membership.role !== 'OWNER') throw new Error('Nur der Wallet-Eigentümer darf diese Aktion ausführen.');
}

async function requireWalletContributor(transaction: WalletTransaction, userId: string, walletId: string) {
  const membership = await requireWalletMembership(transaction, userId, walletId);
  if (!canContributeFamilyVoucher(membership.role)) {
    throw new Error('Mit dem Leserecht können keine Gutscheine freigegeben werden.');
  }
}

async function requireWalletMembership(transaction: WalletTransaction, userId: string, walletId: string) {
  const membership = await transaction.familyWalletMember.findUnique({
    where: { walletId_userId: { walletId, userId } },
    select: { role: true }
  });
  if (!membership) throw new Error('Kein Zugriff auf diese Familien-Wallet.');
  return membership;
}

function strongerRole(current: FamilyWalletRole | undefined, invited: FamilyWalletRole): FamilyWalletRole {
  const weight: Record<FamilyWalletRole, number> = { VIEWER: 1, MEMBER: 2, OWNER: 3 };
  return current && weight[current] > weight[invited] ? current : invited;
}
