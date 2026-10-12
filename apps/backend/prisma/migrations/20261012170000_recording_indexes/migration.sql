-- CreateIndex
CREATE INDEX "recordings_roomId_createdAt_idx" ON "recordings"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "recordings_workerId_idx" ON "recordings"("workerId");

