-- AlterTable
ALTER TABLE "User" ADD COLUMN "supabaseUserId" TEXT;

-- CreateTable
CREATE TABLE "UserDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");
CREATE UNIQUE INDEX "UserDevice_userId_tokenHash_key" ON "UserDevice"("userId", "tokenHash");
CREATE INDEX "UserDevice_userId_revokedAt_idx" ON "UserDevice"("userId", "revokedAt");
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");
CREATE INDEX "UserSession_userId_revokedAt_expiresAt_idx" ON "UserSession"("userId", "revokedAt", "expiresAt");

ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "UserDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
