import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { requireAuth, requireStaff } from "../auth/middleware";
import { paging } from "../lib/pagination";
import { checkAll } from "../services/health";
import {
  PURGE_PERIODS,
  getPurgePeriod,
  setPurgePeriod,
  countEligible,
  purgeRecordings,
} from "../services/recordingPurge";

/** Platform administration API. All routes require an authenticated staff user. */
export const adminRouter = Router();
adminRouter.use(requireAuth, requireStaff);

/* ----------------------------------------------------------------- status -- */

/** GET /status/ — live health of every infrastructure dependency. */
adminRouter.get("/status/", async (_req, res) => {
  res.json(await checkAll());
});

/* ------------------------------------------------------------------ purge -- */

/** GET /purge/ — current purge configuration + how many recordings are eligible. */
adminRouter.get("/purge/", async (_req, res) => {
  if (!env.purge.enabled) return res.json({ enabled: false });
  const period = await getPurgePeriod();
  res.json({
    enabled: true,
    period,
    periods: Object.keys(PURGE_PERIODS),
    eligible_count: await countEligible(period),
  });
});

/** PUT /purge/ — change the retention period (1m | 3m | 6m | 1y). */
adminRouter.put("/purge/", async (req, res) => {
  if (!env.purge.enabled)
    return res.status(403).json({ detail: "Recording purge is disabled." });
  const schema = z.object({ period: z.enum(["1m", "3m", "6m", "1y"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ detail: "Invalid period." });
  const period = await setPurgePeriod(parsed.data.period);
  res.json({
    enabled: true,
    period,
    periods: Object.keys(PURGE_PERIODS),
    eligible_count: await countEligible(period),
  });
});

/** POST /purge/run/ — purge eligible recordings now. */
adminRouter.post("/purge/run/", async (_req, res) => {
  if (!env.purge.enabled)
    return res.status(403).json({ detail: "Recording purge is disabled." });
  const deleted = await purgeRecordings();
  res.json({
    deleted,
    period: await getPurgePeriod(),
    eligible_count: await countEligible(),
  });
});

// Egress connects to rooms as a hidden participant (identity "EG_..."); exclude
// it from human participant counts and attendance lists.
const NOT_EGRESS: Prisma.MeetingParticipantWhereInput = {
  identity: { not: { startsWith: "EG_" } },
};

function userBrief(u: {
  id: string;
  fullName: string | null;
  email: string | null;
  shortName: string | null;
}) {
  return {
    id: u.id,
    full_name: u.fullName ?? "",
    email: u.email ?? "",
    short_name: u.shortName ?? "",
  };
}

const pct = (cur: number, prev: number) =>
  prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0;

type Bucket = { bucket: Date; count: bigint | number };
const toSeries = (rows: Bucket[]) =>
  rows.map((r) => ({ bucket: r.bucket, count: Number(r.count) }));

/* -------------------------------------------------------------- dashboard -- */

/** Rich, single-call payload for the admin dashboard (cards, charts, feeds). */
adminRouter.get("/dashboard/", async (_req, res) => {
  // --- Time series, gap-filled so the charts stay continuous even with zeros.
  const meetingsByHour = await prisma.$queryRaw<Bucket[]>(Prisma.sql`
    WITH h AS (SELECT generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') AS b)
    SELECT h.b AS bucket, count(s.id)::int AS count
    FROM h LEFT JOIN meeting_sessions s ON date_trunc('hour', s."startedAt") = h.b
    GROUP BY h.b ORDER BY h.b`);
  const meetingsByDay = await prisma.$queryRaw<Bucket[]>(Prisma.sql`
    WITH d AS (SELECT generate_series(date_trunc('day', now()) - interval '6 days', date_trunc('day', now()), interval '1 day') AS b)
    SELECT d.b AS bucket, count(s.id)::int AS count
    FROM d LEFT JOIN meeting_sessions s ON date_trunc('day', s."startedAt") = d.b
    GROUP BY d.b ORDER BY d.b`);
  const meetingsByMonth = await prisma.$queryRaw<Bucket[]>(Prisma.sql`
    WITH m AS (SELECT generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS b)
    SELECT m.b AS bucket, count(s.id)::int AS count
    FROM m LEFT JOIN meeting_sessions s ON date_trunc('month', s."startedAt") = m.b
    GROUP BY m.b ORDER BY m.b`);

  const usersByHour = await prisma.$queryRaw<Bucket[]>(Prisma.sql`
    WITH h AS (SELECT generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') AS b)
    SELECT h.b AS bucket, count(distinct s."creatorId")::int AS count
    FROM h LEFT JOIN meeting_sessions s ON date_trunc('hour', s."startedAt") = h.b
    GROUP BY h.b ORDER BY h.b`);
  const usersByDay = await prisma.$queryRaw<Bucket[]>(Prisma.sql`
    WITH d AS (SELECT generate_series(date_trunc('day', now()) - interval '6 days', date_trunc('day', now()), interval '1 day') AS b)
    SELECT d.b AS bucket, count(distinct s."creatorId")::int AS count
    FROM d LEFT JOIN meeting_sessions s ON date_trunc('day', s."startedAt") = d.b
    GROUP BY d.b ORDER BY d.b`);
  const usersByMonth = await prisma.$queryRaw<Bucket[]>(Prisma.sql`
    WITH m AS (SELECT generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS b)
    SELECT m.b AS bucket, count(distinct s."creatorId")::int AS count
    FROM m LEFT JOIN meeting_sessions s ON date_trunc('month', s."startedAt") = m.b
    GROUP BY m.b ORDER BY m.b`);

  // --- Totals & week/month-over-prior trends.
  const [totalsRow] = await prisma.$queryRaw<
    {
      sessions: number;
      active_sessions: number;
      users: number;
      rooms: number;
      recordings: number;
      rec_duration: number;
    }[]
  >(Prisma.sql`
    SELECT
      (SELECT count(*) FROM meeting_sessions)::int AS sessions,
      (SELECT count(*) FROM meeting_sessions WHERE "endedAt" IS NULL)::int AS active_sessions,
      (SELECT count(*) FROM users)::int AS users,
      (SELECT count(*) FROM rooms)::int AS rooms,
      (SELECT count(*) FROM recordings)::int AS recordings,
      (SELECT COALESCE(sum("durationSec"),0) FROM meeting_sessions)::int AS rec_duration`);

  // --- Live state: who is connected right now, as opposed to the cumulative
  // totals above. Egress participants (identity prefixed EG_) are recording
  // bots, not people, so they are excluded — same rule as NOT_EGRESS.
  const [liveRow] = await prisma.$queryRaw<
    { participants: number }[]
  >(Prisma.sql`
    SELECT count(*)::int AS participants
    FROM meeting_participants p
    JOIN meeting_sessions s ON s.id = p."sessionId"
    WHERE s."endedAt" IS NULL
      AND p."lastLeftAt" IS NULL
      AND left(p.identity, 3) <> 'EG_'`);

  const [sw] = await prisma.$queryRaw<
    { cur: number; prev: number }[]
  >(Prisma.sql`
    SELECT
      count(*) FILTER (WHERE "startedAt" >= date_trunc('week', now()))::int AS cur,
      count(*) FILTER (WHERE "startedAt" >= date_trunc('week', now()) - interval '1 week' AND "startedAt" < date_trunc('week', now()))::int AS prev
    FROM meeting_sessions`);
  const [au] = await prisma.$queryRaw<
    { cur: number; prev: number }[]
  >(Prisma.sql`
    SELECT
      count(distinct "creatorId") FILTER (WHERE "startedAt" >= date_trunc('week', now()))::int AS cur,
      count(distinct "creatorId") FILTER (WHERE "startedAt" >= date_trunc('week', now()) - interval '1 week' AND "startedAt" < date_trunc('week', now()))::int AS prev
    FROM meeting_sessions`);
  const [rm] = await prisma.$queryRaw<
    { cur: number; prev: number }[]
  >(Prisma.sql`
    SELECT
      count(*) FILTER (WHERE "createdAt" >= date_trunc('month', now()))::int AS cur,
      count(*) FILTER (WHERE "createdAt" >= date_trunc('month', now()) - interval '1 month' AND "createdAt" < date_trunc('month', now()))::int AS prev
    FROM rooms`);
  const [rc] = await prisma.$queryRaw<
    { cur: number; prev: number }[]
  >(Prisma.sql`
    SELECT
      count(*) FILTER (WHERE "createdAt" >= date_trunc('month', now()))::int AS cur,
      count(*) FILTER (WHERE "createdAt" >= date_trunc('month', now()) - interval '1 month' AND "createdAt" < date_trunc('month', now()))::int AS prev
    FROM recordings`);

  // --- Recent meetings (last 5) & a merged recent-activity feed.
  const recentMeetings = await prisma.meetingSession.findMany({
    orderBy: { startedAt: "desc" },
    take: 5,
    include: {
      room: { select: { id: true, name: true } },
      creator: {
        select: { id: true, fullName: true, email: true, shortName: true },
      },
      _count: { select: { participants: { where: NOT_EGRESS } } },
    },
  });
  const recentRecordings = await prisma.recording.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { room: { select: { name: true } } },
  });

  type Activity = {
    id: string;
    type: string;
    title: string;
    subtitle: string;
    at: string;
  };
  const activity: Activity[] = [];
  for (const s of recentMeetings) {
    activity.push({
      id: `m-${s.id}`,
      type: s.endedAt ? "meeting_ended" : "meeting_started",
      title: s.endedAt ? "Réunion terminée" : "Réunion démarrée",
      subtitle: s.title ?? s.room?.name ?? s.livekitRoomName,
      at: (s.endedAt ?? s.startedAt).toISOString(),
    });
  }
  for (const r of recentRecordings) {
    activity.push({
      id: `r-${r.id}`,
      type: "recording",
      title:
        r.status === "SAVED" ? "Enregistrement disponible" : "Enregistrement",
      subtitle: r.room?.name ?? "—",
      at: r.createdAt.toISOString(),
    });
  }
  activity.sort((a, b) => (a.at < b.at ? 1 : -1));

  res.json({
    totals: {
      sessions: totalsRow.sessions,
      active_sessions: totalsRow.active_sessions,
      users: totalsRow.users,
      rooms: totalsRow.rooms,
      recordings: totalsRow.recordings,
      total_duration_sec: totalsRow.rec_duration,
    },
    live: {
      participants: liveRow.participants,
      meetings: totalsRow.active_sessions,
    },
    trends: {
      sessions_pct: pct(sw.cur, sw.prev),
      active_users_pct: pct(au.cur, au.prev),
      rooms_pct: pct(rm.cur, rm.prev),
      recordings_pct: pct(rc.cur, rc.prev),
    },
    series: {
      meetings: {
        hour: toSeries(meetingsByHour),
        day: toSeries(meetingsByDay),
        month: toSeries(meetingsByMonth),
      },
      active_users: {
        hour: toSeries(usersByHour),
        day: toSeries(usersByDay),
        month: toSeries(usersByMonth),
      },
    },
    recent_meetings: recentMeetings.map((s) => ({
      id: s.id,
      title: s.title ?? s.room?.name ?? s.livekitRoomName,
      room: s.room ? { id: s.room.id, name: s.room.name } : null,
      creator: s.creator ? userBrief(s.creator) : null,
      started_at: s.startedAt.toISOString(),
      ended_at: s.endedAt?.toISOString() ?? null,
      duration_sec: s.durationSec ?? null,
      max_participants: Math.max(s.maxParticipants, s._count.participants),
      is_active: s.endedAt === null,
    })),
    recent_activity: activity.slice(0, 7),
  });
});

/* ------------------------------------------------------------------ stats -- */

adminRouter.get("/stats/", async (_req, res) => {
  const [
    usersTotal,
    usersActive,
    usersStaff,
    roomsTotal,
    sessionsTotal,
    sessionsActive,
    recordingsTotal,
    durationAgg,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isStaff: true } }),
    prisma.room.count(),
    prisma.meetingSession.count(),
    prisma.meetingSession.count({ where: { endedAt: null } }),
    prisma.recording.count(),
    prisma.meetingSession.aggregate({
      _sum: { durationSec: true },
      _avg: { durationSec: true },
      _count: { durationSec: true },
    }),
  ]);

  // Time series (last 12 weeks / 12 months).
  const perWeek = await prisma.$queryRaw<
    { bucket: Date; count: bigint }[]
  >(Prisma.sql`
    SELECT date_trunc('week', "startedAt") AS bucket, count(*)::int AS count
    FROM meeting_sessions
    WHERE "startedAt" >= now() - interval '12 weeks'
    GROUP BY 1 ORDER BY 1`);
  const perMonth = await prisma.$queryRaw<
    { bucket: Date; count: bigint }[]
  >(Prisma.sql`
    SELECT date_trunc('month', "startedAt") AS bucket, count(*)::int AS count
    FROM meeting_sessions
    WHERE "startedAt" >= now() - interval '12 months'
    GROUP BY 1 ORDER BY 1`);

  // Top 5 creators by number of meetings.
  const grouped = await prisma.meetingSession.groupBy({
    by: ["creatorId"],
    where: { creatorId: { not: null } },
    _count: { _all: true },
    _sum: { durationSec: true },
    orderBy: { _count: { creatorId: "desc" } },
    take: 5,
  });
  const creators = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.creatorId!).filter(Boolean) } },
    select: { id: true, fullName: true, email: true, shortName: true },
  });
  const topCreators = grouped.map((g) => {
    const u = creators.find((c) => c.id === g.creatorId);
    return {
      user: u ? userBrief(u) : null,
      meetings: g._count._all,
      total_duration_sec: g._sum.durationSec ?? 0,
    };
  });

  res.json({
    totals: {
      users: usersTotal,
      active_users: usersActive,
      admins: usersStaff,
      rooms: roomsTotal,
      sessions: sessionsTotal,
      active_sessions: sessionsActive,
      recordings: recordingsTotal,
      total_duration_sec: durationAgg._sum.durationSec ?? 0,
      avg_duration_sec: Math.round(durationAgg._avg.durationSec ?? 0),
      finished_sessions: durationAgg._count.durationSec ?? 0,
    },
    meetings_per_week: perWeek.map((r) => ({
      bucket: r.bucket,
      count: Number(r.count),
    })),
    meetings_per_month: perMonth.map((r) => ({
      bucket: r.bucket,
      count: Number(r.count),
    })),
    top_creators: topCreators,
  });
});

/* ------------------------------------------------------------------ users -- */

adminRouter.get("/users/", async (req, res) => {
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

adminRouter.get("/users/:id/", async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { meetingSessions: true, roomAccesses: true } },
    },
  });
  if (!u) return res.status(404).json({ detail: "User not found." });

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

adminRouter.patch("/users/:id/", async (req, res) => {
  const schema = z.object({
    is_active: z.boolean().optional(),
    is_admin: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ detail: "Invalid payload." });

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ detail: "User not found." });

  // Guard against self-lockout: an admin cannot remove their own admin/active.
  if (target.id === req.user!.id) {
    if (parsed.data.is_admin === false || parsed.data.is_active === false) {
      return res
        .status(400)
        .json({ detail: "You cannot revoke your own admin/active status." });
    }
  }

  const data: Prisma.UserUpdateInput = {};
  if (parsed.data.is_active !== undefined)
    data.isActive = parsed.data.is_active;
  if (parsed.data.is_admin !== undefined) data.isStaff = parsed.data.is_admin;
  const updated = await prisma.user.update({ where: { id: target.id }, data });

  res.json({
    ...userBrief(updated),
    is_admin: updated.isStaff,
    is_active: updated.isActive,
  });
});

/* --------------------------------------------------------------- meetings -- */

adminRouter.get("/meetings/", async (req, res) => {
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
adminRouter.get("/meetings/:id/", async (req, res) => {
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
  if (!s) return res.status(404).json({ detail: "Meeting not found." });

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

/* ------------------------------------------------------------- recordings -- */

adminRouter.get("/recordings/", async (req, res) => {
  const { page, pageSize, skip, take } = paging(req.query);
  // Sorting: ?sort=date|user & ?order=asc|desc (default: date desc).
  const order: Prisma.SortOrder = req.query.order === "asc" ? "asc" : "desc";
  const orderBy: Prisma.RecordingOrderByWithRelationInput =
    req.query.sort === "user"
      ? { creator: { fullName: order } }
      : { createdAt: order };

  const [total, recordings] = await Promise.all([
    prisma.recording.count(),
    prisma.recording.findMany({
      orderBy,
      skip,
      take,
      include: {
        room: { select: { id: true, name: true } },
        creator: {
          select: { id: true, fullName: true, email: true, shortName: true },
        },
      },
    }),
  ]);

  const expDays = env.recording.expirationDays;
  res.json({
    count: total,
    page,
    page_size: pageSize,
    results: recordings.map((r) => {
      const expiredAt = expDays
        ? new Date(r.createdAt.getTime() + expDays * 86400000)
        : null;
      return {
        id: r.id,
        room: r.room ? { id: r.room.id, name: r.room.name } : null,
        creator: r.creator ? userBrief(r.creator) : null,
        status: r.status.toLowerCase(),
        mode: r.mode.toLowerCase(),
        created_at: r.createdAt.toISOString(),
        expired_at: expiredAt?.toISOString() ?? null,
      };
    }),
  });
});

/* ------------------------------------------------------------------ rooms -- */

adminRouter.get("/rooms/", async (req, res) => {
  const { page, pageSize, skip, take } = paging(req.query);
  const search = String(req.query.search ?? "").trim();
  const where: Prisma.RoomWhereInput = search
    ? { name: { contains: search, mode: "insensitive" } }
    : {};

  const order: Prisma.SortOrder = req.query.order === "asc" ? "asc" : "desc";
  const orderBy: Prisma.RoomOrderByWithRelationInput =
    req.query.sort === "name"
      ? { name: order }
      : req.query.sort === "sessions"
        ? { sessions: { _count: order } }
        : req.query.sort === "recordings"
          ? { recordings: { _count: order } }
          : { createdAt: order };

  const [total, rooms] = await Promise.all([
    prisma.room.count({ where }),
    prisma.room.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        _count: { select: { sessions: true, recordings: true } },
        accesses: {
          where: { role: "OWNER" },
          take: 1,
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                shortName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  res.json({
    count: total,
    page,
    page_size: pageSize,
    results: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      access_level: r.accessLevel.toLowerCase(),
      created_at: r.createdAt.toISOString(),
      owner: r.accesses[0]?.user ? userBrief(r.accesses[0].user) : null,
      sessions: r._count.sessions,
      recordings: r._count.recordings,
    })),
  });
});
