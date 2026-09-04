-- AlterEnum
ALTER TYPE "NotificationDeliveryStatus" ADD VALUE 'PROCESSING' BEFORE 'DELIVERED';

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "recipient" TEXT,
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN "processingStartedAt" TIMESTAMP(3),
ADD COLUMN "lastError" TEXT,
ADD COLUMN "providerMessageId" TEXT;

-- CreateTable
CREATE TABLE "NotificationDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "successful" BOOLEAN NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_channel_deliveryStatus_nextAttemptAt_idx" ON "Notification"("channel", "deliveryStatus", "nextAttemptAt");
CREATE UNIQUE INDEX "NotificationDeliveryAttempt_notificationId_attemptNumber_key" ON "NotificationDeliveryAttempt"("notificationId", "attemptNumber");
CREATE INDEX "NotificationDeliveryAttempt_createdAt_idx" ON "NotificationDeliveryAttempt"("createdAt");

-- AddForeignKey
ALTER TABLE "NotificationDeliveryAttempt" ADD CONSTRAINT "NotificationDeliveryAttempt_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
