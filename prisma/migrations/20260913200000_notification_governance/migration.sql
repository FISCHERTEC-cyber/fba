-- Extend notification kinds/statuses for lifecycle governance.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'LIFECYCLE';
ALTER TYPE "NotificationDeliveryStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "NotificationDeliveryStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';

CREATE TYPE "NotificationEventFamily" AS ENUM ('RESERVATION', 'TRANSFER', 'PERMISSION', 'CONFLICT', 'FAMILY_COORDINATION');
CREATE TYPE "NotificationPriority" AS ENUM ('INFORMATIONAL', 'NORMAL', 'TIME_SENSITIVE', 'ACTION_BLOCKING');

CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventFamily" "NotificationEventFamily" NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "minimumPriority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_userId_eventFamily_key" ON "NotificationPreference"("userId", "eventFamily");
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD COLUMN "transferId" TEXT,
  ADD COLUMN "reservationId" TEXT,
  ADD COLUMN "eventType" TEXT,
  ADD COLUMN "eventFamily" "NotificationEventFamily",
  ADD COLUMN "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "Notification_transferId_deliveryStatus_idx" ON "Notification"("transferId", "deliveryStatus");
CREATE INDEX "Notification_reservationId_deliveryStatus_idx" ON "Notification"("reservationId", "deliveryStatus");
