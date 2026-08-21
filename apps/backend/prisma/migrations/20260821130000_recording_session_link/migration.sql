-- Link each recording to the meeting occurrence it captured, so participants of
-- that session (not only the person who started the egress) can reach it.

-- AlterTable
ALTER TABLE "recordings" ADD COLUMN     "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "recordings_sessionId_idx" ON "recordings"("sessionId");

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "meeting_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: attach every existing recording to the most recent session of the
-- same room that was already running when the recording was created. The 5 min
-- grace window covers egress rows created just after room_finished.
UPDATE "recordings" r SET "sessionId" = (
  SELECT s.id FROM "meeting_sessions" s
  WHERE s."roomId" = r."roomId"
    AND s."startedAt" <= r."createdAt"
    AND (s."endedAt" IS NULL OR r."createdAt" <= s."endedAt" + interval '5 minutes')
  ORDER BY s."startedAt" DESC
  LIMIT 1
)
WHERE r."sessionId" IS NULL;

-- The user space filters attendance by LiveKit identity.
CREATE INDEX "meeting_participants_identity_idx" ON "meeting_participants"("identity");
