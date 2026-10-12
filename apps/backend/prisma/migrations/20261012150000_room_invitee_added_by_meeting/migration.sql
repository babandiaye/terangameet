-- Which scheduled meeting put someone on a room's list. Existing rows stay NULL:
-- treated as added by hand, so no meeting will ever remove them.
-- AlterTable
ALTER TABLE "room_invitees" ADD COLUMN     "addedByMeetingId" TEXT;

-- AddForeignKey
ALTER TABLE "room_invitees" ADD CONSTRAINT "room_invitees_addedByMeetingId_fkey" FOREIGN KEY ("addedByMeetingId") REFERENCES "scheduled_meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

