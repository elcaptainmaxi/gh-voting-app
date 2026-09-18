CREATE TABLE "CastingBotQueueEvent" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "queuedBy" TEXT,
  CONSTRAINT "CastingBotQueueEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CastingBotQueueEvent_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "CastingApplication"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CastingBotQueueEvent_queuedAt_idx"
  ON "CastingBotQueueEvent"("queuedAt");

CREATE INDEX "CastingBotQueueEvent_applicationId_queuedAt_idx"
  ON "CastingBotQueueEvent"("applicationId", "queuedAt");
