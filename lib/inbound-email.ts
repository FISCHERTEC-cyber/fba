import { z } from 'zod';
import type { ImportSource } from './import-pipeline';

const attachmentSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  base64Data: z.string().min(1).max(14_000_000)
});

export const inboundEmailSchema = z.object({
  messageId: z.string().min(1).max(500),
  from: z.string().email().max(320),
  to: z.string().email().max(320),
  subject: z.string().max(500).default(''),
  text: z.string().max(200_000).optional(),
  receivedAt: z.string().datetime().optional(),
  attachments: z.array(attachmentSchema).max(10).default([])
}).refine(value => Boolean(value.text?.trim()) || value.attachments.length > 0, {
  message: 'Die E-Mail enthält weder Text noch unterstützte Anhänge.'
});

export type InboundEmail = z.infer<typeof inboundEmailSchema>;

export function emailImportSource(email: InboundEmail): ImportSource {
  const text = [email.subject, email.text].filter(Boolean).join('\n').trim();
  if (text) {
    return {
      sourceType: 'EMAIL',
      mimeType: 'text/plain',
      rawText: text,
      sourceReference: email.messageId
    };
  }

  const attachment = email.attachments[0];
  return {
    sourceType: 'EMAIL',
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    base64Data: attachment.base64Data,
    sourceReference: email.messageId
  };
}
