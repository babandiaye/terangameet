import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NOT_EGRESS, userBrief } from "./shared";

/** Administration — dashboard (cards, trend series, activity feeds). */
export const dashboardRouter = Router();

const pct = (cur: number, prev: number) =>
  prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0;

type Bucket = { bucket: Date; count: bigint | number };
const toSeries = (rows: Bucket[]) =>
  rows.map((r) => ({ bucket: r.bucket, count: Number(r.count) }));

/**
 * One gap-filled series. Each range keeps its own bucket size: a 30-day window
 * counted per hour would be 720 unreadable bars, and 12 months counted per day
 * would be 365. The key names the window the reader picked, not the bucket.
 */
const SERIES_SQL = {
  h24: (metric: Prisma.Sql) => Prisma.sql`
    WITH b AS (SELECT generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') AS bucket)
    SELECT b.bucket, ${metric} AS count
    FROM b LEFT JOIN meeting_sessions s ON date_trunc('hour', s."startedAt") = b.bucket
    GROUP BY b.bucket ORDER BY b.bucket`,
  d7: (metric: Prisma.Sql) => Prisma.sql`
    WITH b AS (SELECT generate_series(date_trunc('day', now()) - interval '6 days', date_trunc('day', now()), interval '1 day') AS bucket)
    SELECT b.bucket, ${metric} AS count
    FROM b LEFT JOIN meeting_sessions s ON date_trunc('day', s."startedAt") = b.bucket
    GROUP BY b.bucket ORDER BY b.bucket`,
  d30: (metric: Prisma.Sql) => Prisma.sql`
    WITH b AS (SELECT generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') AS bucket)
    SELECT b.bucket, ${metric} AS count
    FROM b LEFT JOIN meeting_sessions s ON date_trunc('day', s."startedAt") = b.bucket
    GROUP BY b.bucket ORDER BY b.bucket`,
  m12: (metric: Prisma.Sql) => Prisma.sql`
    WITH b AS (SELECT generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS bucket)
    SELECT b.bucket, ${metric} AS count
    FROM b LEFT JOIN meeting_sessions s ON date_trunc('month', s."startedAt") = b.bucket
    GROUP BY b.bucket ORDER BY b.bucket`,
} as const;

const SERIES_RANGES = ["h24", "d7", "d30", "m12"] as const;
const COUNT_MEETINGS = Prisma.sql`count(s.id)::int`;
const COUNT_CREATORS = Prisma.sql`count(distinct s."creatorId")::int`;

/** The four ranges of one metric, fetched concurrently. */
async function seriesSet(metric: Prisma.Sql) {
  const [h24, d7, d30, m12] = await Promise.all(
    SERIES_RANGES.map((r) => prisma.$queryRaw<Bucket[]>(SERIES_SQL[r](metric))),
  );
  return {
    h24: toSeries(h24),
    d7: toSeries(d7),
    d30: toSeries(d30),
    m12: toSeries(m12),
  };
}

/* -------------------------------------------------------------- dashboard -- */

/** Rich, single-call payload for the admin dashboard (cards, charts, feeds). */
dashboardRouter.get("/dashboard/", async (_req, res) => {
  // --- Time series, gap-filled so the charts stay continuous even with zeros.
  const [meetingSeries, activeUserSeries] = await Promise.all([
    seriesSet(COUNT_MEETINGS),
    seriesSet(COUNT_CREATORS),
  ]);

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
      meetings: meetingSeries,
      active_users: activeUserSeries,
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
