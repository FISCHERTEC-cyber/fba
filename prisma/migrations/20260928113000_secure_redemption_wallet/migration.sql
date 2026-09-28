CREATE TYPE "CredentialKind" AS ENUM ('REDEMPTION_CODE', 'PIN', 'BARCODE', 'QR_PAYLOAD', 'ACCOUNT_NUMBER', 'EXTERNAL_TOKEN');
CREATE TYPE "CredentialSecretClass" AS ENUM ('CONFIDENTIAL', 'RESTRICTED');

ALTER TYPE "BenefitAuditAction" ADD VALUE IF NOT EXISTS 'CREDENTIAL_CREATED';
ALTER TYPE "BenefitAuditAction" ADD VALUE IF NOT EXISTS 'CREDENTIAL_REVEALED';
ALTER TYPE "BenefitAuditAction" ADD VALUE IF NOT EXISTS 'OFFLINE_CACHE_ISSUED';
ALTER TYPE "BenefitAuditAction" ADD VALUE IF NOT EXISTS 'OFFLINE_CACHE_REVOKED';

CREATE TABLE "VoucherCredential" (
  "id" TEXT NOT NULL, "voucherId" TEXT NOT NULL, "kind" "CredentialKind" NOT NULL, "label" TEXT,
  "secretClass" "CredentialSecretClass" NOT NULL DEFAULT 'CONFIDENTIAL', "encryptedValue" TEXT NOT NULL,
  "valueFingerprint" TEXT NOT NULL, "maskedValue" TEXT NOT NULL, "revealCount" INTEGER NOT NULL DEFAULT 0,
  "lastRevealedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "VoucherCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VoucherCredential_voucherId_valueFingerprint_key" ON "VoucherCredential"("voucherId", "valueFingerprint");
CREATE INDEX "VoucherCredential_voucherId_revokedAt_idx" ON "VoucherCredential"("voucherId", "revokedAt");
ALTER TABLE "VoucherCredential" ADD CONSTRAINT "VoucherCredential_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OfflineCredentialCache" (
  "id" TEXT NOT NULL, "voucherId" TEXT NOT NULL, "credentialId" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
  "encryptedPayload" TEXT NOT NULL, "payloadHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfflineCredentialCache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OfflineCredentialCache_credentialId_deviceId_key" ON "OfflineCredentialCache"("credentialId", "deviceId");
CREATE INDEX "OfflineCredentialCache_deviceId_revokedAt_expiresAt_idx" ON "OfflineCredentialCache"("deviceId", "revokedAt", "expiresAt");
CREATE INDEX "OfflineCredentialCache_voucherId_revokedAt_idx" ON "OfflineCredentialCache"("voucherId", "revokedAt");
ALTER TABLE "OfflineCredentialCache" ADD CONSTRAINT "OfflineCredentialCache_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfflineCredentialCache" ADD CONSTRAINT "OfflineCredentialCache_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "VoucherCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfflineCredentialCache" ADD CONSTRAINT "OfflineCredentialCache_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "UserDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
