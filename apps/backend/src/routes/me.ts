import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { env } from '../config/env'
import { requireAuth } from '../auth/middleware'
import { paging, paginated } from '../lib/pagination'
import { recordingStatusToApi } from '../lib/recordingStatus'
import {
  attendanceTotals,
  attendedSessionsWhere,
  readableRecordingsWhere,
  sessionTitle,
  userIdentities,
} from '../services/userSpace'

/**
 * Personal space API ("Mon espace"): the admin console's read-only counterpart,
 * scoped to the signed-in user. Every query filters on the caller — there is no
 * id parameter that could widen the scope.
 */
export const meRouter = Router()
meRouter.use(requireAuth)

// The recorder joins rooms as a hidden participant ("EG_..."); never count it.
const NOT_EGRESS: Prisma.MeetingParticipantWhereInput = { identity: { not: { startsWith: 'EG_' } } }

/** Attendance row of the caller inside a session, when we loaded it. */
function myAttendance(participants: { identity: string; firstJoinedAt: Date; lastLeftAt: Date | null }[], identities: string[]) {
  const mine = participants.find((p) => identities.includes(p.identity))
  if (!mine) return { joined_at: null, left_at: null, duration_sec: null }
  const duration = mine.lastLeftAt
    ? Math.max(0, Math.round((mine.lastLeftAt.getTime() - mine.firstJoinedAt.getTime()) / 1000))
    : null
  return {
    joined_at: mine.firstJoinedAt.toISOString(),
    left_at: mine.lastLeftAt?.toISOString() ?? null,
    duration_sec: duration,
  }
}

/* -------------------------------------------------------------- dashboard -- */

/** GET /dashboard/ — headline figures plus the caller's latest meetings. */
meRouter.get('/dashboard/', async (req, res) => {
  const user = req.user!
  const identities = userIdentities(user)
  const where = attendedSessionsWhere(user)

  const [totals, recordings, recent] = await Promise.all([
    attendanceTotals(user),
    prisma.recording.count({ where: readableRecordingsWhere(user) }),
    prisma.meetingSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 5,
      include: {
        room: { select: { id: true, name: true, slug: true } },
        participants: { where: NOT_EGRESS, select: { identity: true, firstJoinedAt: true, lastLeftAt: true } },
        _count: { select: { recordings: true } },
      },
    }),
  ])

  res.json({
    user: {
      id: user.id,
      full_name: user.fullName ?? '',
      email: user.email ?? '',
      short_name: user.shortName ?? '',
    },
    totals: { ...totals, recordings },
    recent_meetings: recent.map((s) => ({
      id: s.id,
      title: sessionTitle(s),
      room: s.room ? { id: s.room.id, name: s.room.name, slug: s.room.slug } : null,
      started_at: s.startedAt.toISOString(),
      ended_at: s.endedAt?.toISOString() ?? null,
      duration_sec: s.durationSec ?? null,
      participants: s.participants.length,
      has_recording: s._count.recordings > 0,
      is_active: s.endedAt === null,
      me: myAttendance(s.participants, identities),
    })),
  })
})

/* --------------------------------------------------------------- meetings -- */

/** GET /meetings/ — paginated history of the sessions the caller attended. */
meRouter.get('/meetings/', async (req, res) => {
  const user = req.user!
  const identities = userIdentities(user)
  const { page, pageSize, skip, take } = paging(req.query)

  const where: Prisma.MeetingSessionWhereInput = { ...attendedSessionsWhere(user) }
  if (req.query.active === 'true') where.endedAt = null

  const [count, sessions] = await Promise.all([
    prisma.meetingSession.count({ where }),
    prisma.meetingSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip,
      take,
      include: {
        room: { select: { id: true, name: true, slug: true } },
        participants: { where: NOT_EGRESS, select: { identity: true, firstJoinedAt: true, lastLeftAt: true } },
        _count: { select: { recordings: true } },
      },
    }),
  ])

  res.json(
    paginated(
      count,
      page,
      pageSize,
      sessions.map((s) => ({
        id: s.id,
        title: sessionTitle(s),
        room: s.room ? { id: s.room.id, name: s.room.name, slug: s.room.slug } : null,
        started_at: s.startedAt.toISOString(),
        ended_at: s.endedAt?.toISOString() ?? null,
        duration_sec: s.durationSec ?? null,
        participants: s.participants.length,
        has_recording: s._count.recordings > 0,
        is_active: s.endedAt === null,
        me: myAttendance(s.participants, identities),
      }))
    )
  )
})

/** GET /meetings/:id/ — detail of one attended session (404 if not attended). */
meRouter.get('/meetings/:id/', async (req, res) => {
  const user = req.user!
  const identities = userIdentities(user)

  const s = await prisma.meetingSession.findFirst({
    // The attendance clause is the authorization: a session the caller never
    // joined simply does not exist for them.
    where: { id: req.params.id, ...attendedSessionsWhere(user) },
    include: {
      room: { select: { id: true, name: true, slug: true } },
      participants: { where: NOT_EGRESS, orderBy: { firstJoinedAt: 'asc' } },
      recordings: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!s) return res.status(404).json({ detail: 'Réunion introuvable.' })

  res.json({
    id: s.id,
    title: sessionTitle(s),
    room: s.room ? { id: s.room.id, name: s.room.name, slug: s.room.slug } : null,
    started_at: s.startedAt.toISOString(),
    ended_at: s.endedAt?.toISOString() ?? null,
    duration_sec: s.durationSec ?? null,
    is_active: s.endedAt === null,
    me: myAttendance(s.participants, identities),
    participants: s.participants.map((p) => {
      const duration = p.lastLeftAt
        ? Math.max(0, Math.round((p.lastLeftAt.getTime() - p.firstJoinedAt.getTime()) / 1000))
        : null
      return {
        id: p.id,
        name: p.name || p.identity,
        is_me: identities.includes(p.identity),
        first_joined_at: p.firstJoinedAt.toISOString(),
        last_left_at: p.lastLeftAt?.toISOString() ?? null,
        duration_sec: duration,
        still_present: p.lastLeftAt === null,
      }
    }),
    recordings: s.recordings.map((r) => ({
      id: r.id,
      status: recordingStatusToApi(r.status),
      mode: r.mode.toLowerCase(),
      created_at: r.createdAt.toISOString(),
    })),
  })
})

/* ------------------------------------------------------------- recordings -- */

/** GET /recordings/ — recordings of the sessions the caller attended. */
meRouter.get('/recordings/', async (req, res) => {
  const user = req.user!
  const { page, pageSize, skip, take } = paging(req.query)
  const where = readableRecordingsWhere(user)

  const [count, recordings] = await Promise.all([
    prisma.recording.count({ where }),
    prisma.recording.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        room: { select: { id: true, name: true, slug: true } },
        session: { select: { id: true, title: true, livekitRoomName: true, startedAt: true, durationSec: true } },
      },
    }),
  ])

  const expDays = env.recording.expirationDays
  res.json(
    paginated(
      count,
      page,
      pageSize,
      recordings.map((r) => {
        const expiredAt = expDays ? new Date(r.createdAt.getTime() + expDays * 86400000) : null
        return {
          id: r.id,
          room: r.room ? { id: r.room.id, name: r.room.name, slug: r.room.slug } : null,
          session: r.session
            ? {
                id: r.session.id,
                title: r.session.title ?? r.room?.name ?? r.session.livekitRoomName,
                started_at: r.session.startedAt.toISOString(),
                duration_sec: r.session.durationSec ?? null,
              }
            : null,
          status: recordingStatusToApi(r.status),
          mode: r.mode.toLowerCase(),
          is_owner: r.creatorId === user.id,
          created_at: r.createdAt.toISOString(),
          expired_at: expiredAt?.toISOString() ?? null,
          is_expired: expiredAt ? expiredAt.getTime() < Date.now() : false,
        }
      })
    )
  )
})
