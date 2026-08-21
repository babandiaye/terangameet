-- AlterTable
ALTER TABLE "recordings" ADD COLUMN     "creatorId" TEXT;

-- CreateIndex
CREATE INDEX "recordings_creatorId_idx" ON "recordings"("creatorId");

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill creator from the existing OWNER access (earliest one).
UPDATE "recordings" r SET "creatorId" = (
  SELECT ra."userId" FROM "recording_accesses" ra
  WHERE ra."recordingId" = r.id AND ra."role" = 'OWNER' AND ra."userId" IS NOT NULL
  ORDER BY ra."createdAt" ASC LIMIT 1
)
WHERE r."creatorId" IS NULL;
