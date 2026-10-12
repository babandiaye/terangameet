-- CreateTable
CREATE TABLE "room_invitee_periods" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "since" TIMESTAMP(3) NOT NULL,
    "until" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_invitee_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_invitee_periods_email_idx" ON "room_invitee_periods"("email");

-- AddForeignKey
ALTER TABLE "room_invitee_periods" ADD CONSTRAINT "room_invitee_periods_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

