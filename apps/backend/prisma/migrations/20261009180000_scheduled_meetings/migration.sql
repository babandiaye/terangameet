-- CreateEnum
CREATE TYPE "ScheduledMeetingStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendeeResponse" AS ENUM ('NEEDS_ACTION', 'ACCEPTED', 'DECLINED', 'TENTATIVE');

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "scheduled_meetings" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Dakar',
    "status" "ScheduledMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "googleEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendees" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "response" "AttendeeResponse" NOT NULL DEFAULT 'NEEDS_ACTION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_meetings_organizerId_startsAt_idx" ON "scheduled_meetings"("organizerId", "startsAt");

-- CreateIndex
CREATE INDEX "scheduled_meetings_startsAt_idx" ON "scheduled_meetings"("startsAt");

-- CreateIndex
CREATE INDEX "meeting_attendees_email_idx" ON "meeting_attendees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_attendees_meetingId_email_key" ON "meeting_attendees"("meetingId", "email");

-- AddForeignKey
ALTER TABLE "scheduled_meetings" ADD CONSTRAINT "scheduled_meetings_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_meetings" ADD CONSTRAINT "scheduled_meetings_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "scheduled_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

