CREATE TYPE "BenefitActionType" AS ENUM ('ACCEPT_TRANSFER', 'DECLINE_TRANSFER', 'RELEASE_RESERVATION', 'RESERVATION_EXPIRING', 'TRANSFER_EXPIRING', 'REVIEW_CONFLICT', 'REVIEW_PERMISSION_CHANGE', 'RETRY_FAILED_ACTION', 'ACKNOWLEDGE_COMPLETED_TRANSFER');
CREATE TYPE "BenefitActionPriority" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL', 'LOW');
CREATE TYPE "BenefitActionStatus" AS ENUM ('OPEN', 'SNOOZED', 'COMPLETED', 'EXPIRED', 'DISMISSED', 'SUPERSEDED');

CREATE TABLE "BenefitActionItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "voucherId" TEXT,
  "reservationId" TEXT,
  "transferId" TEXT,
  "type" "BenefitActionType" NOT NULL,
  "priority" "BenefitActionPriority" NOT NULL DEFAULT 'NORMAL',
  "status" "BenefitActionStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "snoozedUntil" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "sourceKey" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BenefitActionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BenefitActionItem_sourceKey_key" ON "BenefitActionItem"("sourceKey");
CREATE INDEX "BenefitActionItem_userId_status_dueAt_idx" ON "BenefitActionItem"("userId", "status", "dueAt");
CREATE INDEX "BenefitActionItem_transferId_idx" ON "BenefitActionItem"("transferId");
CREATE INDEX "BenefitActionItem_reservationId_idx" ON "BenefitActionItem"("reservationId");

ALTER TABLE "BenefitActionItem" ADD CONSTRAINT "BenefitActionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenefitActionItem" ADD CONSTRAINT "BenefitActionItem_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
