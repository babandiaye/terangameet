-- Co-hosts of a scheduled meeting (made co-organizers of its room).
ALTER TABLE "meeting_attendees" ADD COLUMN "isCoHost" BOOLEAN NOT NULL DEFAULT false;
