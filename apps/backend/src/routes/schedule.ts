import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { Prisma, type MeetingAttendee, type Room, type ScheduledMeeting, type User } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { env } from '../config/env'
import { logger } from '../lib/logger'
import { requireAuth } from '../auth/middleware'
import { searchLimiter } from '../middleware/rateLimit'
import { parseEmailList } from '../lib/roomAccess'
import { buildIcs } from '../lib/ics'
import { sendMail } from '../lib/mailer'
import { scheduleHtml, scheduleSubject, scheduleText, type ScheduleMailKind } from '../lib/scheduleMail'
import { getRole } from '../services/rooms'
import { getSetting } from '../services/settings'
import { findPeople } from '../services/people'
import { generateRoomSlug } from '../utils/slug'

/**
 * Scheduled meetings — the calendar side of TerangaMeet (phase 1).
 *
 * Any signed-in user plans a meeting at a date, in one of their rooms or a new
 * one, and invites people by email. Invitations are iCalendar emails: Gmail
 * shows Yes / No / Maybe and puts the event in the guest's Google Calendar,
 * link included. The organiser is the iCalendar ORGANIZER, so replies reach
 * their own mailbox. Guests are also added to the room's participant list, so
 * they get in without waiting even when the room is restricted.
 *
 * The whole feature is off until an administrator enables it (and SMTP is
 * configured: there is no calendar without the invitations).
 */
export const scheduleRouter = Router()
scheduleRouter.use(requireAuth)
scheduleRouter.use(async (_req: Request, res: Response, next: NextFunction) => {
  if (!env.mail.enabled || !(await getSetting('calendar.enabled'))) {
    return res.status(403).json({ detail: 'L’agenda n’est pas activé sur la plateforme.' })
  }
  next()
})

const MAX_ATTENDEES = 200
const MAX_DURATION_MS = 24 * 3600 * 1000
const TIMEZONE = 'Africa/Dakar'

const roomUrl = (room: Pick<Room, 'slug' | 'id'>) =>
  `${env.APP_BASE_URL.replace(/\/$/, '')}/${room.slug ?? room.id}`

const icsUid = (id: string) => `${id}@${new URL(env.APP_BASE_URL).hostname}`

type MeetingWithRelations = ScheduledMeeting & {
  room: Room
  organizer: Pick<User, 'id' | 'fullName' | 'email'>
  attendees: MeetingAttendee[]
}

const withRelations = {
  room: true,
  organizer: { select: { id: true, fullName: true, email: true } },
  attendees: { orderBy: { email: 'asc' } },
} satisfies Prisma.ScheduledMeetingInclude

/** Account names of the attendees who already signed in once. */
async function namesByEmail(emails: string[]): Promise<Map<string, string | null>> {
  if (!emails.length) return new Map()
  const rows = await prisma.$queryRaw<{ email: string; full_name: string | null }[]>(Prisma.sql`
    SELECT lower(email) AS email, "fullName" AS full_name
    FROM users WHERE lower(email) IN (${Prisma.join(emails)})`)
  return new Map(rows.map((r) => [r.email, r.full_name]))
}

async function serialize(m: MeetingWithRelations, user: User) {
  const names = await namesByEmail(m.attendees.map((a) => a.email))
  const myEmail = user.email?.toLowerCase()
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    starts_at: m.startsAt.toISOString(),
    ends_at: m.endsAt.toISOString(),
    timezone: m.timezone,
    status: m.status.toLowerCase(),
    room: { id: m.room.id, name: m.room.name, slug: m.room.slug ?? m.room.id, url: roomUrl(m.room) },
    organizer: { full_name: m.organizer.fullName, email: m.organizer.email },
    is_organizer: m.organizerId === user.id,
    attendees: m.attendees.map((a) => ({
      email: a.email,
      full_name: names.get(a.email) ?? null,
      response: a.response.toLowerCase(),
      is_me: a.email === myEmail,
    })),
  }
}

/** A meeting the caller organises or is invited to; null (→ 404) otherwise. */
async function visibleMeeting(id: string, user: User): Promise<MeetingWithRelations | null> {
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
 * A few at a time — up to 200 guests must not open 200 SMTP sessions at once.
 */
async function sendInvitations(
  m: MeetingWithRelations,
  kind: ScheduleMailKind,
  recipients: string[]
): Promise<{ sent: number; failed: string[] }> {
  const organizerEmail = m.organizer.email!.toLowerCase()
  const names = await namesByEmail(m.attendees.map((a) => a.email))
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
    organizer: { email: organizerEmail, name: m.organizer.fullName },
    attendees: m.attendees.map((a) => ({ email: a.email, name: names.get(a.email) })),
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
    icalEvent: { method: kind === 'cancel' ? ('CANCEL' as const) : ('REQUEST' as const), content: ics },
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

/** Put the guests on the room's participant list (restricted rooms let them in). */
async function listInRoom(roomId: string, emails: string[], invitedById: string) {
  if (!emails.length) return
  await prisma.roomInvitee.createMany({
    data: emails.map((email) => ({ roomId, email, invitedById })),
    skipDuplicates: true,
  })
}

const slotSchema = z
  .object({
    starts_at: z.coerce.date(),
    ends_at: z.coerce.date(),
  })
  .refine((s) => s.ends_at > s.starts_at, { message: 'La fin doit suivre le début.' })
  .refine((s) => s.ends_at.getTime() - s.starts_at.getTime() <= MAX_DURATION_MS, {
    message: 'Une réunion dure au plus 24 heures.',
  })

/** First validation message, phrased for the person filling the form. */
const firstIssue = (err: z.ZodError) => err.issues[0]?.message ?? 'Requête invalide.'

/* ----------------------------------------------------------------- read -- */

/** GET / — upcoming meetings I organise or am invited to (default: from an hour ago). */
scheduleRouter.get('/', async (req, res) => {
  const user = req.user!
  const email = user.email?.toLowerCase()
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 3600 * 1000)
  if (Number.isNaN(from.getTime())) return res.status(400).json({ detail: 'Date invalide.' })
  const meetings = await prisma.scheduledMeeting.findMany({
    where: {
      status: 'SCHEDULED',
      endsAt: { gte: from },
      OR: [{ organizerId: user.id }, ...(email ? [{ attendees: { some: { email } } }] : [])],
    },
    orderBy: { startsAt: 'asc' },
    take: 100,
    include: withRelations,
  })
  res.json({ results: await Promise.all(meetings.map((m) => serialize(m, user))) })
})

/** GET /people/?q= — members to suggest as guests (the caller excluded). */
scheduleRouter.get('/people/', searchLimiter, async (req, res) => {
  const results = await findPeople(String(req.query.q ?? ''), {
    userIds: Prisma.sql`SELECT ${req.user!.id}`,
  })
  res.json({ results })
})

/** GET /:id/ */
scheduleRouter.get('/:id/', async (req, res) => {
  const m = await visibleMeeting(req.params.id, req.user!)
  if (!m) return res.status(404).json({ detail: 'Réunion introuvable.' })
  res.json(await serialize(m, req.user!))
})

/* ---------------------------------------------------------------- write -- */

const createSchema = z
  .object({
    title: z.string().trim().min(1, 'Donnez un titre à la réunion.').max(120),
    description: z.string().trim().max(5000).default(''),
    /** An existing room I organise; omitted → a new room titled like the meeting. */
    room_id: z.string().optional(),
    attendees: z.array(z.string()).max(MAX_ATTENDEES).default([]),
  })
  .and(slotSchema)

/** POST / — plan a meeting and send the invitations. */
scheduleRouter.post('/', async (req, res) => {
  const user = req.user!
  if (!user.email) return res.status(400).json({ detail: 'Votre compte n’a pas d’adresse email.' })
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ detail: firstIssue(parsed.error) })
  const body = parsed.data
  if (body.starts_at.getTime() < Date.now() - 5 * 60 * 1000) {
    return res.status(400).json({ detail: 'La réunion ne peut pas commencer dans le passé.' })
  }

  const { valid: attendees, invalid } = parseEmailList(body.attendees)
  if (invalid.length) return res.status(400).json({ detail: `Adresse invalide : ${invalid[0]}` })
  const guests = attendees.filter((e) => e !== user.email!.toLowerCase())

  let room: Room | null
  if (body.room_id) {
    room = await prisma.room.findUnique({ where: { id: body.room_id } }).catch(() => null)
    const role = room ? await getRole(room.id, user.id) : null
    if (!room || (role !== 'OWNER' && role !== 'ADMIN')) {
      return res.status(404).json({ detail: 'Salle introuvable.' })
    }
  } else {
    room = await prisma.room.create({
      data: {
        name: body.title,
        slug: generateRoomSlug(),
        accessLevel: env.rooms.defaultAccessLevel.toUpperCase() as Room['accessLevel'],
        accesses: { create: { userId: user.id, role: 'OWNER' } },
      },
    })
  }

  const created = await prisma.scheduledMeeting.create({
    data: {
      roomId: room.id,
      organizerId: user.id,
      title: body.title,
      description: body.description,
      startsAt: body.starts_at,
      endsAt: body.ends_at,
      timezone: TIMEZONE,
      attendees: { create: guests.map((email) => ({ email })) },
    },
    include: withRelations,
  })
  await listInRoom(room.id, guests, user.id)
  const mail = await sendInvitations(created, 'new', guests)
  logger.info(`[schedule] ${user.email} planned ${created.id} with ${guests.length} guest(s)`)
  res.status(201).json({ meeting: await serialize(created, user), mail })
})

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(5000).optional(),
    starts_at: z.coerce.date().optional(),
    ends_at: z.coerce.date().optional(),
    attendees: z.array(z.string()).max(MAX_ATTENDEES).optional(),
  })

/** PATCH /:id/ — change a meeting (organiser only); guests receive the update. */
scheduleRouter.patch('/:id/', async (req, res) => {
  const user = req.user!
  const m = await visibleMeeting(req.params.id, user)
  if (!m || m.organizerId !== user.id) return res.status(404).json({ detail: 'Réunion introuvable.' })
  if (m.status === 'CANCELLED') return res.status(409).json({ detail: 'Cette réunion est annulée.' })
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ detail: firstIssue(parsed.error) })
  const body = parsed.data

  const slot = slotSchema.safeParse({
    starts_at: body.starts_at ?? m.startsAt,
    ends_at: body.ends_at ?? m.endsAt,
  })
  if (!slot.success) return res.status(400).json({ detail: firstIssue(slot.error) })

  let guests = m.attendees.map((a) => a.email)
  if (body.attendees) {
    const { valid, invalid } = parseEmailList(body.attendees)
    if (invalid.length) return res.status(400).json({ detail: `Adresse invalide : ${invalid[0]}` })
    guests = valid.filter((e) => e !== user.email?.toLowerCase())
  }
  const before = new Set(m.attendees.map((a) => a.email))
  const removed = [...before].filter((e) => !guests.includes(e))
  const added = guests.filter((e) => !before.has(e))

  // Removed guests get a cancellation first, while they are still on the event.
  if (removed.length) {
    await sendInvitations({ ...m, sequence: m.sequence + 1 }, 'cancel', removed)
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (removed.length) {
      await tx.meetingAttendee.deleteMany({ where: { meetingId: m.id, email: { in: removed } } })
    }
    if (added.length) {
      await tx.meetingAttendee.createMany({
        data: added.map((email) => ({ meetingId: m.id, email })),
        skipDuplicates: true,
      })
    }
    return tx.scheduledMeeting.update({
      where: { id: m.id },
      data: {
        title: body.title ?? m.title,
        description: body.description ?? m.description,
        startsAt: slot.data.starts_at,
        endsAt: slot.data.ends_at,
        sequence: { increment: 1 },
      },
      include: withRelations,
    })
  })
  await listInRoom(updated.roomId, added, user.id)
  const mail = await sendInvitations(updated, 'update', guests)
  res.json({ meeting: await serialize(updated, user), mail })
})

/** DELETE /:id/ — cancel (organiser only): the event leaves every calendar. */
scheduleRouter.delete('/:id/', async (req, res) => {
  const user = req.user!
  const m = await visibleMeeting(req.params.id, user)
  if (!m || m.organizerId !== user.id) return res.status(404).json({ detail: 'Réunion introuvable.' })
  if (m.status === 'CANCELLED') return res.json({ mail: { sent: 0, failed: [] } })
  const cancelled = await prisma.scheduledMeeting.update({
    where: { id: m.id },
    data: { status: 'CANCELLED', sequence: { increment: 1 } },
    include: withRelations,
  })
  const mail = await sendInvitations(
    cancelled,
    'cancel',
    cancelled.attendees.map((a) => a.email)
  )
  logger.info(`[schedule] ${user.email} cancelled ${m.id}`)
  res.json({ mail })
})
