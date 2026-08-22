import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../auth/middleware";
import { resolveRoom } from "../services/rooms";

/** Private per-participant meeting notes, mounted under /api/v1.0/rooms. */
export const notesRouter = Router();

// requireAuth is attached per route, never with a path-less router.use(): this
// router shares the /rooms mount with the public join and lobby routes, and a
// blanket guard here answers 401 for every one of them without calling next().
/** GET /:roomId/notes/ — current user's private notes for this room. */
notesRouter.get("/:roomId/notes/", requireAuth, async (req, res) => {
  const { livekitRoom } = await resolveRoom(req.params.roomId);
  const note = await prisma.meetingNote.findUnique({
    where: { userId_roomKey: { userId: req.user!.id, roomKey: livekitRoom } },
  });
  res.json({
    content: note?.content ?? "",
    updated_at: note?.updatedAt.toISOString() ?? null,
  });
});

/** PUT /:roomId/notes/ — upsert the current user's private notes. */
notesRouter.put("/:roomId/notes/", requireAuth, async (req, res) => {
  const parsed = z.string().max(100000).safeParse(req.body?.content);
  if (!parsed.success)
    return res.status(400).json({ detail: "Invalid content." });
  const { livekitRoom } = await resolveRoom(req.params.roomId);
  const note = await prisma.meetingNote.upsert({
    where: { userId_roomKey: { userId: req.user!.id, roomKey: livekitRoom } },
    create: {
      userId: req.user!.id,
      roomKey: livekitRoom,
      content: parsed.data,
    },
    update: { content: parsed.data },
  });
  res.json({ content: note.content, updated_at: note.updatedAt.toISOString() });
});
