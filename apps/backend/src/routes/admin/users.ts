import { Router } from "express";
import { logger } from "../../lib/logger";
import { ejectFromAllRooms } from "../../services/eject";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { paging } from "../../lib/pagination";
import { userBrief } from "./shared";

/** Administration — user accounts. */
export const usersRouter = Router();

/* ------------------------------------------------------------------ users -- */

usersRouter.get("/users/", async (req, res) => {
  const { page, pageSize, skip, take } = paging(req.query);
  const search = String(req.query.search ?? "").trim();
  const where: Prisma.UserWhereInput = search
    ? {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        _count: { select: { meetingSessions: true, roomAccesses: true } },
      },
    }),
  ]);

  res.json({
    count: total,
    page,
    page_size: pageSize,
    results: users.map((u) => ({
      ...userBrief(u),
      is_admin: u.isStaff,
      is_active: u.isActive,
      created_at: u.createdAt.toISOString(),
      meetings_created: u._count.meetingSessions,
      rooms: u._count.roomAccesses,
    })),
  });
});

usersRouter.get("/users/:id/", async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { meetingSessions: true, roomAccesses: true } },
    },
  });
  if (!u) return res.status(404).json({ detail: "Utilisateur introuvable." });

  const sessions = await prisma.meetingSession.findMany({
    where: { creatorId: u.id },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { room: { select: { name: true } } },
  });

  res.json({
    ...userBrief(u),
    is_admin: u.isStaff,
    is_active: u.isActive,
    language: u.language,
    timezone: u.timezone,
    created_at: u.createdAt.toISOString(),
    meetings_created: u._count.meetingSessions,
    rooms: u._count.roomAccesses,
    recent_sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title ?? s.room?.name ?? s.livekitRoomName,
      started_at: s.startedAt.toISOString(),
      ended_at: s.endedAt?.toISOString() ?? null,
      duration_sec: s.durationSec ?? null,
      max_participants: s.maxParticipants,
    })),
  });
});

usersRouter.patch("/users/:id/", async (req, res) => {
  const schema = z.object({
    is_active: z.boolean().optional(),
    is_admin: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ detail: "Requête invalide." });

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ detail: "Utilisateur introuvable." });

  // Guard against self-lockout: an admin cannot remove their own admin/active.
  if (target.id === req.user!.id) {
    if (parsed.data.is_admin === false || parsed.data.is_active === false) {
      return res
        .status(400)
        .json({ detail: "Vous ne pouvez pas retirer vos propres droits ni désactiver votre propre compte." });
    }
  }

  const data: Prisma.UserUpdateInput = {};
  if (parsed.data.is_active !== undefined)
    data.isActive = parsed.data.is_active;
  if (parsed.data.is_admin !== undefined) data.isStaff = parsed.data.is_admin;
  const updated = await prisma.user.update({ where: { id: target.id }, data });

  // Deactivated: out of every meeting in progress, right now. Their token
  // stays valid for hours, so the webhook also refuses any later join.
  let ejected = 0;
  if (target.isActive && !updated.isActive) {
    try {
      ejected = await ejectFromAllRooms(updated);
      logger.info(`[admin] ${updated.email} deactivated by ${req.user!.email}, removed from ${ejected} meeting(s)`);
    } catch (err) {
      logger.error(`[admin] could not remove ${updated.email} from meetings`, err);
    }
  }

  res.json({
    ...userBrief(updated),
    is_admin: updated.isStaff,
    is_active: updated.isActive,
    ejected_from_meetings: ejected,
  });
});
