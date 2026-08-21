-- CreateTable
CREATE TABLE "meeting_sessions" (
    "id" TEXT NOT NULL,
    "livekitSid" TEXT,
    "livekitRoomName" TEXT NOT NULL,
    "title" TEXT,
    "roomId" TEXT,
    "creatorId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "maxParticipants" INTEGER NOT NULL DEFAULT 0,
    "totalJoins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_sessions_livekitSid_key" ON "meeting_sessions"("livekitSid");

-- CreateIndex
CREATE INDEX "meeting_sessions_startedAt_idx" ON "meeting_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "meeting_sessions_creatorId_idx" ON "meeting_sessions"("creatorId");

-- CreateIndex
CREATE INDEX "meeting_sessions_roomId_idx" ON "meeting_sessions"("roomId");

-- AddForeignKey
ALTER TABLE "meeting_sessions" ADD CONSTRAINT "meeting_sessions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_sessions" ADD CONSTRAINT "meeting_sessions_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
