import { prisma } from '../lib/prisma'

/**
 * Take people off a room's participant list. They lose their place in the room
 * (direct entry to a restricted room, recordings made from now on), but a trace
 * of their stay is kept in room_invitee_periods so the recordings made while
 * they were listed stay theirs — someone legitimately invited keeps the record
 * of the meetings they were invited to.
 */
export async function removeRoomInvitees(roomId: string, emails: string[]): Promise<number> {
  if (!emails.length) return 0
  return prisma.$transaction(async (tx) => {
    const rows = await tx.roomInvitee.findMany({ where: { roomId, email: { in: emails } } })
    if (!rows.length) return 0
    await tx.roomInviteePeriod.createMany({
      data: rows.map((r) => ({ roomId, email: r.email, since: r.createdAt })),
    })
    await tx.roomInvitee.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
    return rows.length
  })
}

/**
 * Guests a meeting no longer brings to its room — taken off the meeting, or the
 * meeting cancelled. Someone still expected at another upcoming meeting in the
 * same room keeps their place.
 */
export async function releaseMeetingGuests(roomId: string, meetingId: string, emails: string[]): Promise<number> {
  if (!emails.length) return 0
  const stillExpected = await prisma.meetingAttendee.findMany({
    where: {
      email: { in: emails },
      meeting: { roomId, id: { not: meetingId }, status: 'SCHEDULED', endsAt: { gt: new Date() } },
    },
    select: { email: true },
  })
  const keep = new Set(stillExpected.map((a) => a.email))
  return removeRoomInvitees(
    roomId,
    emails.filter((e) => !keep.has(e))
  )
}
