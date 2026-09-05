-- CreateEnum
CREATE TYPE "ImportCandidateStatus" AS ENUM ('PENDING', 'IMPORTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "VoucherImportCandidate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "analysis" JSONB NOT NULL,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" "ImportCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VoucherImportCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoucherImportCandidate_userId_providerMessageId_key" ON "VoucherImportCandidate"("userId", "providerMessageId");
CREATE INDEX "VoucherImportCandidate_userId_status_receivedAt_idx" ON "VoucherImportCandidate"("userId", "status", "receivedAt");

-- AddForeignKey
ALTER TABLE "VoucherImportCandidate" ADD CONSTRAINT "VoucherImportCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
