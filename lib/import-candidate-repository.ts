import { Prisma } from '@prisma/client';
import type { ImportAnalysis } from './import-pipeline';
import type { InboundEmail } from './inbound-email';
import { prisma } from './prisma';
import { voucherExtractionSchema, type VoucherExtraction } from './extraction';
import { assertExtractionReviewed, reviewedVoucherData } from './voucher-repository';

export async function saveEmailImportCandidate(userId: string, email: InboundEmail, analysis: ImportAnalysis) {
  return prisma.voucherImportCandidate.upsert({
    where: { userId_providerMessageId: { userId, providerMessageId: email.messageId } },
    create: {
      userId,
      providerMessageId: email.messageId,
      sender: email.from,
      recipient: email.to,
      subject: email.subject,
      receivedAt: email.receivedAt ? new Date(email.receivedAt) : new Date(),
      analysis: analysis as unknown as Prisma.InputJsonValue,
      reviewRequired: analysis.reviewRequired
    },
    update: {}
  });
}

export async function listPendingImportCandidates(userId: string) {
  return prisma.voucherImportCandidate.findMany({
    where: { userId, status: 'PENDING' },
    orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }]
  });
}

export async function dismissImportCandidate(userId: string, id: string) {
  const result = await prisma.voucherImportCandidate.updateMany({
    where: { id, userId, status: 'PENDING' },
    data: { status: 'DISMISSED', processedAt: new Date() }
  });
  if (!result.count) throw new Error('Offener Importkandidat wurde nicht gefunden.');
}

export async function importCandidateAsVoucher(input: {
  userId: string;
  id: string;
  extraction: VoucherExtraction;
  confirmedFields?: string[];
}) {
  const extraction = voucherExtractionSchema.parse(input.extraction);
  assertExtractionReviewed(extraction, input.confirmedFields);

  return prisma.$transaction(async transaction => {
    const candidate = await transaction.voucherImportCandidate.findFirst({
      where: { id: input.id, userId: input.userId, status: 'PENDING' }
    });
    if (!candidate) throw new Error('Offener Importkandidat wurde nicht gefunden.');

    const voucher = await transaction.voucher.create({
      data: reviewedVoucherData(input.userId, extraction)
    });
    await transaction.voucherImportCandidate.update({
      where: { id: candidate.id },
      data: { status: 'IMPORTED', voucherId: voucher.id, processedAt: new Date() }
    });
    return voucher;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
