import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'

/**
 * Meeting-session tracking driven by LiveKit room webhooks. A "session" is one
 * real meeting occurrence (room_started → room_finished), attributed to the
 * registered room and its owner. Powers the admin history & statistics.
 */

interface LkRoom {
  sid?: string
  name?: string
  numParticipants?: number
  creationTime?: number | bigint | string
}

interface LkParticipant {
  identity?: string
  name?: string
  joinedAt?: number | bigint | string
}

/** Convert a LiveKit unix-seconds timestamp to a Date, falling back to now. */
function tsToDate(ts?: number | bigint | string): Date {
  if (ts == null) return new Date()
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0) return new Date()
  return new Date(n * 1000)
}

/** The LiveKit room name is the registered Room.id; resolve room + its owner. */
async function resolveRoomAndCreator(roomName?: string) {
  if (!roomName) return { roomId: null, creatorId: null, title: null as string | null }
  const room = await prisma.room.findFirst({ where: { id: roomName } })
  if (!room) return { roomId: null, creatorId: null, title: null }
  const owner = await prisma.roomAccess.findFirst({
    where: { roomId: room.id, role: 'OWNER' },
    orderBy: { createdAt: 'asc' },
  })
  return { roomId: room.id, creatorId: owner?.userId ?? null, title: room.name }
}

export async function onRoomStarted(room: LkRoom) {
  const sid = room.sid || null
  // Idempotent: ignore duplicates for the same LiveKit session id.
  if (sid) {
    const existing = await prisma.meetingSession.findUnique({ where: { livekitSid: sid } })
    if (existing) return
  }
  const { roomId, creatorId, title } = await resolveRoomAndCreator(room.name)
  await prisma.meetingSession.create({
    data: {
      livekitSid: sid,
      livekitRoomName: room.name ?? '',
      title,
      roomId,
      creatorId,
      maxParticipants: room.numParticipants ?? 0,
    },
  })
  logger.info(`[session] started ${room.name} (sid=${sid})`)
}

/** Find the open session for a LiveKit room (by sid, else most recent open one). */
async function findOpenSession(room: LkRoom) {
  if (room.sid) {
    const bySid = await prisma.meetingSession.findUnique({ where: { livekitSid: room.sid } })
    if (bySid) return bySid
  }
  if (!room.name) return null
  return prisma.meetingSession.findFirst({
    where: { livekitRoomName: room.name, endedAt: null },
    orderBy: { startedAt: 'desc' },
  })
}

export async function onParticipant(
  room: LkRoom,
  participant: LkParticipant,
  kind: 'joined' | 'left'
) {
  let session = await findOpenSession(room)
  // A participant may join before we processed room_started; create lazily.
  if (!session && kind === 'joined') {
    await onRoomStarted(room)
    session = await findOpenSession(room)
  }
  if (!session) return

  const current = room.numParticipants ?? 0
  await prisma.meetingSession.update({
    where: { id: session.id },
    data: {
      maxParticipants: Math.max(session.maxParticipants, current),
      ...(kind === 'joined' ? { totalJoins: { increment: 1 } } : {}),
    },
  })

  const identity = participant.identity
  if (!identity) return

  if (kind === 'joined') {
    const joinedAt = tsToDate(participant.joinedAt)
    // Keep the earliest join; reconnection clears the previous lastLeftAt.
    await prisma.meetingParticipant.upsert({
      where: { sessionId_identity: { sessionId: session.id, identity } },
      create: { sessionId: session.id, identity, name: participant.name ?? null, firstJoinedAt: joinedAt, lastLeftAt: null },
      update: { name: participant.name ?? undefined, lastLeftAt: null },
    })
  } else {
    // Record the latest leave; create a row if we somehow missed the join.
    await prisma.meetingParticipant.upsert({
      where: { sessionId_identity: { sessionId: session.id, identity } },
      create: { sessionId: session.id, identity, name: participant.name ?? null, lastLeftAt: new Date() },
      update: { name: participant.name ?? undefined, lastLeftAt: new Date() },
    })
  }
}

/**
 * Id of the meeting occurrence currently running in a LiveKit room, if any.
 * Used to attach a recording to the session it captures.
 */
export async function currentSessionId(livekitRoomName: string): Promise<string | null> {
  const session = await prisma.meetingSession.findFirst({
    where: { livekitRoomName, endedAt: null },
    orderBy: { startedAt: 'desc' },
    select: { id: true },
  })
  return session?.id ?? null
}

export async function onRoomFinished(room: LkRoom) {
  const session = await findOpenSession(room)
  if (!session) return
  const endedAt = new Date()
  const durationSec = Math.max(0, Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000))
  await prisma.meetingSession.update({
    where: { id: session.id },
    data: { endedAt, durationSec },
  })
  // Anyone still "present" left when the room closed.
  await prisma.meetingParticipant.updateMany({
    where: { sessionId: session.id, lastLeftAt: null },
    data: { lastLeftAt: endedAt },
  })
  logger.info(`[session] finished ${room.name} — ${durationSec}s, max ${session.maxParticipants} participants`)
}
