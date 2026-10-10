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
 * A user's standing on rooms, as far as recordings go — loaded once per request
 * by recordingStanding(), so the rule itself stays pure and testable.
 */
export interface RecordingStanding {
  /** Rooms they own or co-organize: every recording, present or not. */
  hostedRoomIds: string[]
  /**
   * Rooms where they are a listed participant, and since when: recordings made
   * from that date on, so someone added late does not get the whole history.
   */
  listedSince: { roomId: string; since: Date }[]
}

export const NO_STANDING: RecordingStanding = { hostedRoomIds: [], listedSince: [] }

/**
 * Recordings the user may read:
 *   - those they started (RecordingAccess);
 *   - those captured during a session they attended;
 *   - every recording of a room they own or co-organize, even when absent;
 *   - those of a room where they are a listed participant, made after they were
 *     added — so a staff member who missed the meeting can catch up.
 * Guests without an account never qualify: they have no lasting identity.
 */
export function readableRecordingsWhere(
  user: Pick<User, 'id' | 'sub'>,
  standing: RecordingStanding = NO_STANDING
): Prisma.RecordingWhereInput {
  return {
    OR: [
      { accesses: { some: { userId: user.id } } },
      { session: attendedSessionsWhere(user) },
      ...(standing.hostedRoomIds.length ? [{ roomId: { in: standing.hostedRoomIds } }] : []),
      ...standing.listedSince.map((l) => ({ roomId: l.roomId, createdAt: { gte: l.since } })),
    ],
  }
}

/**
 * Recordings a user may open by id (detail, playback, download). Platform
 * administrators may open any — the admin console lists every recording and
 * links to it. The personal list (GET /recordings/) stays strictly personal.
 */
export function recordingVisibleTo(
  user: Pick<User, 'id' | 'sub' | 'isStaff'>,
  standing: RecordingStanding = NO_STANDING
): Prisma.RecordingWhereInput {
  return user.isStaff ? {} : readableRecordingsWhere(user, standing)
}

/**
 * Load the rooms that open recordings to this user beyond attendance. Owners and
 * co-organizers come from RoomAccess (OWNER/ADMIN) and from the participant list
 * (co-organizer flag); listed participants from the list, matched on the
 * account email as getRole() does.
 */
export async function recordingStanding(user: Pick<User, 'id' | 'email'>): Promise<RecordingStanding> {
  const email = user.email?.toLowerCase()
  const [accesses, invitees] = await Promise.all([
    prisma.roomAccess.findMany({
      where: { userId: user.id, role: { in: ['OWNER', 'ADMIN'] } },
      select: { roomId: true },
    }),
    email
      ? prisma.roomInvitee.findMany({
          where: { email },
          select: { roomId: true, isCoOrganizer: true, createdAt: true },
        })
      : Promise.resolve([]),
  ])
  const hosted = new Set([
    ...accesses.map((a) => a.roomId),
    ...invitees.filter((i) => i.isCoOrganizer).map((i) => i.roomId),
  ])
  return {
    hostedRoomIds: [...hosted],
    listedSince: invitees
      .filter((i) => !hosted.has(i.roomId))
      .map((i) => ({ roomId: i.roomId, since: i.createdAt })),
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
