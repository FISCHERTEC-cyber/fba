CREATE TYPE "DataExportFormat" AS ENUM ('JSON', 'CSV', 'ZIP', 'PDF');
CREATE TYPE "DataExportStatus" AS ENUM ('REQUESTED', 'READY', 'EXPIRED', 'FAILED');
CREATE TYPE "AccountDeletionStatus" AS ENUM ('REQUESTED', 'BLOCKED_BY_WALLET_OWNERSHIP', 'SCHEDULED', 'CANCELLED', 'COMPLETED');

CREATE TABLE "DataExportRequest" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "format" "DataExportFormat" NOT NULL DEFAULT 'JSON', "includeSensitiveData" BOOLEAN NOT NULL DEFAULT false,
  "includeAuditData" BOOLEAN NOT NULL DEFAULT true, "includeAttachments" BOOLEAN NOT NULL DEFAULT false, "status" "DataExportStatus" NOT NULL DEFAULT 'REQUESTED',
  "manifest" JSONB, "checksum" TEXT, "downloadTokenHash" TEXT, "downloadExpiresAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataExportRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DataExportRequest_downloadTokenHash_key" ON "DataExportRequest"("downloadTokenHash");
CREATE INDEX "DataExportRequest_userId_status_createdAt_idx" ON "DataExportRequest"("userId", "status", "createdAt");
ALTER TABLE "DataExportRequest" ADD CONSTRAINT "DataExportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BackupProfile" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "format" "DataExportFormat" NOT NULL DEFAULT 'JSON',
  "includeSensitiveData" BOOLEAN NOT NULL DEFAULT false, "includeAuditData" BOOLEAN NOT NULL DEFAULT true, "retentionDays" INTEGER NOT NULL DEFAULT 30,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "lastSnapshotAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BackupProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BackupProfile_userId_name_key" ON "BackupProfile"("userId", "name");
CREATE INDEX "BackupProfile_userId_enabled_idx" ON "BackupProfile"("userId", "enabled");
ALTER TABLE "BackupProfile" ADD CONSTRAINT "BackupProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AccountDeletionRequest" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "status" "AccountDeletionStatus" NOT NULL DEFAULT 'REQUESTED', "executeAfter" TIMESTAMP(3), "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "cancelledAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccountDeletionRequest_userId_status_idx" ON "AccountDeletionRequest"("userId", "status");
ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
