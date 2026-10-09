-- CreateTable
CREATE TABLE "room_invitees" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isCoOrganizer" BOOLEAN NOT NULL DEFAULT false,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_invitees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_invitees_email_idx" ON "room_invitees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "room_invitees_roomId_email_key" ON "room_invitees"("roomId", "email");

-- AddForeignKey
ALTER TABLE "room_invitees" ADD CONSTRAINT "room_invitees_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_invitees" ADD CONSTRAINT "room_invitees_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

