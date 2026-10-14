import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

type Tx = Prisma.TransactionClient

/** Move rows to room_invitee_periods, then off the list (inside a transaction). */
async function endStays(
  tx: Tx,
  roomId: string,
  rows: { id: string; email: string; createdAt: Date; addedByMeetingId: string | null }[]
) {
  if (!rows.length) return 0
  await tx.roomInviteePeriod.createMany({
    data: rows.map((r) => ({ roomId, email: r.email, since: r.createdAt, wholeHistory: !r.addedByMeetingId })),
  })
  await tx.roomInvitee.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
  return rows.length
}

/**
 * Take people off a room's participant list. They lose their place in the room
 * (direct entry to a restricted room, recordings made from now on), but a trace
 * of their stay is kept in room_invitee_periods so what they could read stays
 * theirs: a member added directly keeps the room's recordings up to their
 * removal, a meeting guest those made while listed.
 */
export async function removeRoomInvitees(roomId: string, emails: string[]): Promise<number> {
  if (!emails.length) return 0
  return prisma.$transaction(async (tx) => {
    const rows = await tx.roomInvitee.findMany({ where: { roomId, email: { in: emails } } })
    return endStays(tx, roomId, rows)
  })
}

/**
 * Guests a meeting no longer brings to its room — taken off the meeting, or the
 * meeting cancelled. Only people this meeting put on the list are concerned:
 * someone added by hand, already listed before, or co-organizer is never
 * removed by a meeting (otherwise any co-organizer could remove another by
 * planning then cancelling a meeting). Someone still expected at another
 * upcoming meeting of the room keeps their place, now attached to that meeting.
 * Check and removal share one transaction, so a meeting created meanwhile
 * cannot lose its guest.
 */
export async function releaseMeetingGuests(roomId: string, meetingId: string, emails: string[]): Promise<number> {
  if (!emails.length) return 0
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.roomInvitee.findMany({
        where: { roomId, email: { in: emails }, addedByMeetingId: meetingId, isCoOrganizer: false },
      })
      if (!rows.length) return 0
      const elsewhere = await tx.meetingAttendee.findMany({
        where: {
          email: { in: rows.map((r) => r.email) },
          meeting: { roomId, id: { not: meetingId }, status: 'SCHEDULED', endsAt: { gt: new Date() } },
        },
        select: { email: true, meetingId: true },
      })
      const nextMeeting = new Map(elsewhere.map((a) => [a.email, a.meetingId]))
      for (const r of rows) {
        const other = nextMeeting.get(r.email)
        if (other) await tx.roomInvitee.update({ where: { id: r.id }, data: { addedByMeetingId: other } })
      }
      return endStays(
        tx,
        roomId,
        rows.filter((r) => !nextMeeting.has(r.email))
      )
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
}
