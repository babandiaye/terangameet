-- CreateTable
CREATE TABLE "meeting_participants" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "name" TEXT,
    "firstJoinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLeftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_participants_sessionId_idx" ON "meeting_participants"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_participants_sessionId_identity_key" ON "meeting_participants"("sessionId", "identity");

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "meeting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
