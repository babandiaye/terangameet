import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { paging } from "../../lib/pagination";
import { NOT_EGRESS, userBrief } from "./shared";

/** Administration — meeting history. */
export const meetingsRouter = Router();

/* --------------------------------------------------------------- meetings -- */

meetingsRouter.get("/meetings/", async (req, res) => {
  const { page, pageSize, skip, take } = paging(req.query);
  const where: Prisma.MeetingSessionWhereInput = {};
  if (req.query.creatorId) where.creatorId = String(req.query.creatorId);
  if (req.query.from || req.query.to) {
    where.startedAt = {};
    if (req.query.from)
      (where.startedAt as Prisma.DateTimeFilter).gte = new Date(
        String(req.query.from),
      );
    if (req.query.to)
      (where.startedAt as Prisma.DateTimeFilter).lte = new Date(
        String(req.query.to),
      );
  }
  if (req.query.active === "true") where.endedAt = null;

  const [total, sessions] = await Promise.all([
    prisma.meetingSession.count({ where }),
    prisma.meetingSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip,
      take,
      include: {
        room: { select: { id: true, name: true, slug: true } },
        creator: {
          select: { id: true, fullName: true, email: true, shortName: true },
        },
        _count: { select: { participants: { where: NOT_EGRESS } } },
      },
    }),
  ]);

  res.json({
    count: total,
    page,
    page_size: pageSize,
    results: sessions.map((s) => ({
      id: s.id,
      title: s.title ?? s.room?.name ?? s.livekitRoomName,
      room: s.room
        ? { id: s.room.id, name: s.room.name, slug: s.room.slug }
        : null,
      creator: s.creator ? userBrief(s.creator) : null,
      started_at: s.startedAt.toISOString(),
      ended_at: s.endedAt?.toISOString() ?? null,
      duration_sec: s.durationSec ?? null,
      // Real attendance = distinct human participants who joined (maxParticipants
      // from webhooks is unreliable: numParticipants is often absent → 0).
      max_participants: Math.max(s.maxParticipants, s._count.participants),
      total_joins: s.totalJoins,
      is_active: s.endedAt === null,
    })),
  });
});

/** GET /meetings/:id/ — session detail with the per-participant attendance. */
meetingsRouter.get("/meetings/:id/", async (req, res) => {
  const s = await prisma.meetingSession.findUnique({
    where: { id: req.params.id },
    include: {
      room: { select: { id: true, name: true, slug: true } },
      creator: {
        select: { id: true, fullName: true, email: true, shortName: true },
      },
      participants: { where: NOT_EGRESS, orderBy: { firstJoinedAt: "asc" } },
    },
  });
  if (!s) return res.status(404).json({ detail: "Réunion introuvable." });

  res.json({
    id: s.id,
    title: s.title ?? s.room?.name ?? s.livekitRoomName,
    room: s.room
      ? { id: s.room.id, name: s.room.name, slug: s.room.slug }
      : null,
    creator: s.creator ? userBrief(s.creator) : null,
    started_at: s.startedAt.toISOString(),
    ended_at: s.endedAt?.toISOString() ?? null,
    duration_sec: s.durationSec ?? null,
    max_participants: Math.max(s.maxParticipants, s.participants.length),
    total_joins: s.totalJoins,
    is_active: s.endedAt === null,
    participants: s.participants.map((p) => {
      const left = p.lastLeftAt;
      const durationSec = left
        ? Math.max(
            0,
            Math.round((left.getTime() - p.firstJoinedAt.getTime()) / 1000),
          )
        : null;
      return {
        id: p.id,
        identity: p.identity,
        name: p.name || p.identity,
        first_joined_at: p.firstJoinedAt.toISOString(),
        last_left_at: left?.toISOString() ?? null,
        duration_sec: durationSec,
        still_present: left === null,
      };
    }),
  });
});
