import { Prisma } from '@prisma/client';
import type { ImportAnalysis } from './import-pipeline';
import type { InboundEmail } from './inbound-email';
import { prisma } from './prisma';

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
