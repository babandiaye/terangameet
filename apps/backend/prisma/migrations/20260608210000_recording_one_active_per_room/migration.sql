-- At most one in-progress recording per room (INITIATED or ACTIVE).
-- Enforced at the database level to close the check-then-create race in
-- POST /:roomId/start-recording/.
CREATE UNIQUE INDEX "recordings_one_active_per_room"
  ON "recordings" ("roomId")
  WHERE status IN ('INITIATED', 'ACTIVE');
