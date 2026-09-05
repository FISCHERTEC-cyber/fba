-- CreateEnum
CREATE TYPE "FamilyWalletRole" AS ENUM ('OWNER', 'MEMBER', 'VIEWER');

-- CreateTable
CREATE TABLE "FamilyWallet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FamilyWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyWalletMember" (
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FamilyWalletRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FamilyWalletMember_pkey" PRIMARY KEY ("walletId", "userId")
);

-- CreateTable
CREATE TABLE "FamilyWalletInvitation" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "FamilyWalletRole" NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FamilyWalletInvitation_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN "walletId" TEXT;

-- CreateIndex
CREATE INDEX "FamilyWallet_createdByUserId_idx" ON "FamilyWallet"("createdByUserId");
CREATE INDEX "FamilyWalletMember_userId_idx" ON "FamilyWalletMember"("userId");
CREATE UNIQUE INDEX "FamilyWalletInvitation_tokenHash_key" ON "FamilyWalletInvitation"("tokenHash");
CREATE INDEX "FamilyWalletInvitation_walletId_email_acceptedAt_revokedAt_idx" ON "FamilyWalletInvitation"("walletId", "email", "acceptedAt", "revokedAt");
CREATE INDEX "FamilyWalletInvitation_email_expiresAt_idx" ON "FamilyWalletInvitation"("email", "expiresAt");
CREATE INDEX "Voucher_walletId_status_idx" ON "Voucher"("walletId", "status");

-- AddForeignKey
ALTER TABLE "FamilyWallet" ADD CONSTRAINT "FamilyWallet_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyWalletMember" ADD CONSTRAINT "FamilyWalletMember_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "FamilyWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyWalletMember" ADD CONSTRAINT "FamilyWalletMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyWalletInvitation" ADD CONSTRAINT "FamilyWalletInvitation_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "FamilyWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyWalletInvitation" ADD CONSTRAINT "FamilyWalletInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyWalletInvitation" ADD CONSTRAINT "FamilyWalletInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "FamilyWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
