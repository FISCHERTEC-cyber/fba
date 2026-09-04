-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VoucherKind" AS ENUM ('VALUE', 'DISCOUNT', 'SERVICE', 'CASHBACK', 'STORE_CREDIT', 'LOYALTY');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('ACTIVE', 'REDEEMED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PHOTO', 'PDF', 'SCREENSHOT', 'EMAIL', 'MANUAL', 'WALLET');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "merchantUrl" TEXT,
    "title" TEXT NOT NULL,
    "kind" "VoucherKind" NOT NULL,
    "valueAmount" DECIMAL(12,2),
    "currency" TEXT DEFAULT 'EUR',
    "discountPercent" DECIMAL(5,2),
    "code" TEXT,
    "barcode" TEXT,
    "qrPayload" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "minimumOrderValue" DECIMAL(12,2),
    "redemptionUrl" TEXT,
    "terms" TEXT,
    "physicalVoucher" BOOLEAN NOT NULL DEFAULT false,
    "storageLocation" TEXT,
    "storageLocationPhotoUrl" TEXT,
    "lastLocationUpdate" TIMESTAMP(3),
    "status" "VoucherStatus" NOT NULL DEFAULT 'ACTIVE',
    "eventMonitoringEnabled" BOOLEAN NOT NULL DEFAULT false,
    "extractionConfidence" DOUBLE PRECISION,
    "sourceType" "SourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherTransaction" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "note" TEXT,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoucherTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "sourceCheckedAt" TIMESTAMP(3),
    "distanceKm" DOUBLE PRECISION,
    "relevanceScore" INTEGER NOT NULL DEFAULT 0,
    "reasonJson" JSONB,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "checkIntervalHours" INTEGER NOT NULL DEFAULT 24,
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etag" TEXT,
    "lastModified" TEXT,
    "contentHash" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantEvent" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "sourceLabel" TEXT,
    "categories" TEXT[],
    "fingerprint" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL,
    "lastChangedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "MerchantSource_userId_enabled_idx" ON "MerchantSource"("userId", "enabled");
CREATE INDEX "MerchantSource_enabled_nextCheckAt_idx" ON "MerchantSource"("enabled", "nextCheckAt");
CREATE UNIQUE INDEX "MerchantSource_userId_url_key" ON "MerchantSource"("userId", "url");
CREATE INDEX "MerchantEvent_sourceId_active_idx" ON "MerchantEvent"("sourceId", "active");
CREATE INDEX "MerchantEvent_endsAt_idx" ON "MerchantEvent"("endsAt");
CREATE UNIQUE INDEX "MerchantEvent_sourceId_externalKey_key" ON "MerchantEvent"("sourceId", "externalKey");

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantSource" ADD CONSTRAINT "MerchantSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantEvent" ADD CONSTRAINT "MerchantEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MerchantSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
