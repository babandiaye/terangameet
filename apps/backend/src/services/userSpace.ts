import type { User } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

/**
 * Personal space ("Mon espace") — everything a non-admin user may see about
 * their own activity. Attendance is keyed on the LiveKit participant identity,
 * which routes/rooms.ts derives as `user.sub || user.id` (guests get "anon-*").
 *
 * Attribution is strictly attendance-based: MeetingSession.creatorId is the
 * *room owner*, not necessarily someone who joined, so a room owner must not
 * inherit visibility over meetings other people held in their room.
 */

/** The LiveKit identities that belong to this user. */
export function userIdentities(user: Pick<User, 'id' | 'sub'>): string[] {
  return [user.sub, user.id].filter((v): v is string => !!v)
}

/** Sessions the user actually joined. */
export function attendedSessionsWhere(user: Pick<User, 'id' | 'sub'>): Prisma.MeetingSessionWhereInput {
  return { participants: { some: { identity: { in: userIdentities(user) } } } }
}

/**
 * Recordings the user may read: those they started (RecordingAccess) plus those
 * captured during a session they attended.
 */
export function readableRecordingsWhere(user: Pick<User, 'id' | 'sub'>): Prisma.RecordingWhereInput {
  return {
    OR: [
      { accesses: { some: { userId: user.id } } },
      { session: attendedSessionsWhere(user) },
    ],
  }
}

/** Display title of a session, falling back to the room name then the LiveKit name. */
export function sessionTitle(s: {
  title: string | null
  livekitRoomName: string
  room?: { name: string } | null
}): string {
  return s.title ?? s.room?.name ?? s.livekitRoomName
}

export interface AttendanceTotals {
  meetings: number
  total_duration_sec: number
  avg_duration_sec: number
  ongoing: number
  last_meeting_at: string | null
}

/**
 * Aggregate the user's own attendance. Durations are per-participation
 * (lastLeftAt - firstJoinedAt), not the meeting length: what matters here is
 * the time *they* spent. Rows still open contribute nothing.
 */
export async function attendanceTotals(user: Pick<User, 'id' | 'sub'>): Promise<AttendanceTotals> {
  const identities = userIdentities(user)
  if (identities.length === 0) {
    return { meetings: 0, total_duration_sec: 0, avg_duration_sec: 0, ongoing: 0, last_meeting_at: null }
  }

  const [row] = await prisma.$queryRaw<
    { meetings: number; total_sec: number; finished: number; ongoing: number; last_at: Date | null }[]
  >(Prisma.sql`
    SELECT
      count(*)::int AS meetings,
      COALESCE(sum(EXTRACT(EPOCH FROM ("lastLeftAt" - "firstJoinedAt")))::int, 0) AS total_sec,
      count(*) FILTER (WHERE "lastLeftAt" IS NOT NULL)::int AS finished,
      count(*) FILTER (WHERE "lastLeftAt" IS NULL)::int AS ongoing,
      max("firstJoinedAt") AS last_at
    FROM meeting_participants
    WHERE identity IN (${Prisma.join(identities)})`)

  const total = row?.total_sec ?? 0
  const finished = row?.finished ?? 0
  return {
    meetings: row?.meetings ?? 0,
    total_duration_sec: total,
    avg_duration_sec: finished > 0 ? Math.round(total / finished) : 0,
    ongoing: row?.ongoing ?? 0,
    last_meeting_at: row?.last_at ? row.last_at.toISOString() : null,
  }
}
