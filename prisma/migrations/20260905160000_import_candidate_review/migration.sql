-- AlterTable
ALTER TABLE "VoucherImportCandidate"
ADD COLUMN "voucherId" TEXT,
ADD COLUMN "processedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "VoucherImportCandidate_voucherId_key" ON "VoucherImportCandidate"("voucherId");

-- AddForeignKey
ALTER TABLE "VoucherImportCandidate" ADD CONSTRAINT "VoucherImportCandidate_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
