/**
 * Scheduled meetings: serialization, visibility, invitations (iCalendar
 * emails), and how a meeting is mirrored on its room and in Google Calendar.
 * The HTTP side lives in routes/schedule.ts.
 */
import { Prisma, type MeetingAttendee, type Room, type ScheduledMeeting, type User } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { env } from '../config/env'
import { logger } from '../lib/logger'
import { buildIcs } from '../lib/ics'
import { sendMail } from '../lib/mailer'
import { scheduleHtml, scheduleSubject, scheduleText, type ScheduleMailKind } from '../lib/scheduleMail'
import { getRole } from './rooms'
import { accountNames } from './people'
import { roomUrl } from '../lib/roomLinks'
import { buildGoogleEvent } from '../lib/googleEvent'

/** What happened to the invitations: who sent them, and who could not be reached. */
export interface MailReport {
  sent: number
  failed: string[]
  via: 'google' | 'email'
}

export const TIMEZONE = 'Africa/Dakar'


export const icsUid = (id: string) => `${id}@${new URL(env.APP_BASE_URL).hostname}`

export type MeetingWithRelations = ScheduledMeeting & {
  room: Room
  organizer: Pick<User, 'id' | 'fullName' | 'email'>
  attendees: MeetingAttendee[]
}

export const withRelations = {
  room: true,
  organizer: { select: { id: true, fullName: true, email: true } },
  attendees: { orderBy: { email: 'asc' } },
} satisfies Prisma.ScheduledMeetingInclude


export async function serializeMeeting(m: MeetingWithRelations, user: User) {
  const names = await accountNames(m.attendees.map((a) => a.email))
  const myEmail = user.email?.toLowerCase()
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    starts_at: m.startsAt.toISOString(),
    ends_at: m.endsAt.toISOString(),
    timezone: m.timezone,
    status: m.status.toLowerCase(),
    room: {
      id: m.room.id,
      name: m.room.name,
      slug: m.room.slug ?? m.room.id,
      url: roomUrl(m.room),
    },
    organizer: { full_name: m.organizer.fullName, email: m.organizer.email },
    is_organizer: m.organizerId === user.id,
    /** Only the room's owner may name co-hosts. */
    can_manage_co_hosts: m.organizerId === user.id && (await getRole(m.roomId, user.id)) === 'OWNER',
    /** Where the invitations live: the organiser's Google Calendar or email. */
    channel: m.googleEventId ? 'google' : 'email',
    attendees: m.attendees.map((a) => ({
      email: a.email,
      full_name: names.get(a.email) ?? null,
      response: a.response.toLowerCase(),
      is_me: a.email === myEmail,
      is_co_host: a.isCoHost,
    })),
  }
}

/** A meeting the caller organises or is invited to; null (→ 404) otherwise. */
export async function visibleMeeting(id: string, user: User): Promise<MeetingWithRelations | null> {
  const email = user.email?.toLowerCase()
  return prisma.scheduledMeeting
    .findFirst({
      where: {
        id,
        OR: [{ organizerId: user.id }, ...(email ? [{ attendees: { some: { email } } }] : [])],
      },
      include: withRelations,
    })
    .catch(() => null)
}

/**
 * Email the invitation (or its update / cancellation) to the given people.
 * The organiser is always included, so the event lands in their calendar too.
 *
 * The calendar ORGANIZER is TerangaMeet's sending address, with the creator
 * listed as an attendee who already accepted. When the organizer is a Google
 * account (all of @unchk.edu.sn), Gmail ignores the attached .ics and looks
 * the event up in that account's Google Calendar — where TerangaMeet never
 * created it — and shows the creator « Impossible de charger l'événement ».
 * Guests' Yes / No / Maybe replies therefore go to that address, unread.
 * A few at a time — up to 200 guests must not open 200 SMTP sessions at once.
 */
export async function sendInvitations(
  m: MeetingWithRelations,
  kind: ScheduleMailKind,
  recipients: string[]
): Promise<{ sent: number; failed: string[] }> {
  const organizerEmail = m.organizer.email!.toLowerCase()
  const names = await accountNames(m.attendees.map((a) => a.email))
  const organizerName = m.organizer.fullName || organizerEmail
  const ics = buildIcs({
    method: kind === 'cancel' ? 'CANCEL' : 'REQUEST',
    uid: icsUid(m.id),
    sequence: m.sequence,
    stamp: new Date(),
    start: m.startsAt,
    end: m.endsAt,
    summary: m.title,
    description: m.description,
    url: roomUrl(m.room),
    organizer: { email: env.mail.from, name: `${organizerName} via TerangaMeet` },
    attendees: [
      { email: organizerEmail, name: m.organizer.fullName, accepted: true },
      ...m.attendees
        .filter((a) => a.email !== organizerEmail)
        .map((a) => ({ email: a.email, name: names.get(a.email) })),
    ],
  })
  const content = {
    kind,
    organizer: organizerName,
    title: m.title,
    description: m.description || undefined,
    start: m.startsAt,
    end: m.endsAt,
    timezone: m.timezone,
    url: roomUrl(m.room),
  }
  const mail = {
    subject: scheduleSubject(content),
    text: scheduleText(content),
    html: scheduleHtml(content),
    icalEvent: {
      method: kind === 'cancel' ? ('CANCEL' as const) : ('REQUEST' as const),
      content: ics,
    },
  }

  const to = [...new Set([organizerEmail, ...recipients])]
  const failed: string[] = []
  for (let i = 0; i < to.length; i += 5) {
    const batch = to.slice(i, i + 5)
    const results = await Promise.allSettled(batch.map((address) => sendMail({ to: address, ...mail })))
    results.forEach((r, j) => {
      if (r.status === 'rejected') {
        failed.push(batch[j])
        logger.warn(`[schedule] ${kind} mail to ${batch[j]} failed: ${String(r.reason)}`)
      }
    })
  }
  return { sent: to.length - failed.length, failed }
}

/**
 * Mirror the meeting on its room: guests join the participant list (restricted
 * rooms let them in), co-hosts become co-organizers (they moderate every
 * session), and a co-host who lost the role loses it on the room too.
 */
export async function syncRoomPeople(
  roomId: string,
  invitedById: string,
  change: { guests: string[]; promoted: string[]; demoted: string[] }
) {
  if (change.guests.length) {
    await prisma.roomInvitee.createMany({
      data: change.guests.map((email) => ({ roomId, email, invitedById })),
      skipDuplicates: true,
    })
  }
  if (change.promoted.length) {
    await prisma.roomInvitee.updateMany({
      where: { roomId, email: { in: change.promoted } },
      data: { isCoOrganizer: true },
    })
  }
  if (change.demoted.length) {
    await prisma.roomInvitee.updateMany({
      where: { roomId, email: { in: change.demoted } },
      data: { isCoOrganizer: false },
    })
  }
}

/** The meeting as Google Calendar receives it. */
export const googleEventOf = (m: MeetingWithRelations) =>
  buildGoogleEvent({
    id: m.id,
    title: m.title,
    description: m.description,
    startsAt: m.startsAt,
    endsAt: m.endsAt,
    timezone: m.timezone,
    url: roomUrl(m.room),
    attendees: m.attendees.map((a) => a.email),
  })
