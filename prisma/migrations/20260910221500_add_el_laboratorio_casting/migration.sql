-- CreateEnum
CREATE TYPE "CastingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "robloxId" TEXT,
ADD COLUMN "robloxUsername" TEXT,
ADD COLUMN "robloxDisplayName" TEXT,
ADD COLUMN "robloxAvatar" TEXT;

-- CreateTable
CREATE TABLE "CastingApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CastingStatus" NOT NULL DEFAULT 'PENDING',
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CastingApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_robloxId_key" ON "User"("robloxId");
CREATE UNIQUE INDEX "CastingApplication_userId_key" ON "CastingApplication"("userId");
CREATE INDEX "CastingApplication_status_idx" ON "CastingApplication"("status");
CREATE INDEX "CastingApplication_submittedAt_idx" ON "CastingApplication"("submittedAt");

-- AddForeignKey
ALTER TABLE "CastingApplication"
ADD CONSTRAINT "CastingApplication_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
