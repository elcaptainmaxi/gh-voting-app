-- CreateEnum
CREATE TYPE "CastingClassification" AS ENUM ('NONE', 'FAVORITE', 'REVIEW_AGAIN');

-- AlterTable
ALTER TABLE "CastingApplication"
ADD COLUMN "classification" "CastingClassification" NOT NULL DEFAULT 'NONE',
ADD COLUMN "lastReviewedByUserId" TEXT,
ADD COLUMN "lastReviewedByName" TEXT;

-- CreateTable
CREATE TABLE "CastingReviewEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CastingReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CastingApplication_classification_idx" ON "CastingApplication"("classification");
CREATE INDEX "CastingReviewEvent_applicationId_createdAt_idx" ON "CastingReviewEvent"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "CastingReviewEvent"
ADD CONSTRAINT "CastingReviewEvent_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "CastingApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
