import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { Prisma, type Role, type Room } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { env } from '../config/env'
import { logger } from '../lib/logger'
import { requireAuth } from '../auth/middleware'
import { inviteLimiter, searchLimiter } from '../middleware/rateLimit'
import { paging, paginated } from '../lib/pagination'
import { parseEmailList } from '../lib/roomAccess'
import { FOLD_FROM, FOLD_TO, searchTerms } from '../lib/peopleSearch'
import { sendMail } from '../lib/mailer'
import { getRole } from '../services/rooms'
import { generateRoomSlug } from '../utils/slug'
import { buildHtml, buildText } from './invite'

/**
 * "Mes salles" — the rooms a user organises: those they own, and those where
 * they are listed as co-organizer. From here they rename a room, pick its
 * access type (through PATCH /rooms/:id, which also tells a running session)
 * and keep its list of expected participants.
 *
 * Mounted on its own path (/api/v1.0/me/rooms), so the router-wide guard below
 * cannot leak onto the shared /rooms routes.
 */
export const myRoomsRouter = Router()
myRoomsRouter.use(requireAuth)

/** A room's participant list is capped: it feeds one-click email invitations. */
const MAX_INVITEES = 300
const ACCESS_LEVELS = ['public', 'trusted', 'restricted'] as const

/** Rooms the user organises: owner/admin by RoomAccess, or co-organizer by email. */
function organisedRoomsWhere(user: { id: string; email: string | null }): Prisma.RoomWhereInput {
  const or: Prisma.RoomWhereInput[] = [
    { accesses: { some: { userId: user.id, role: { in: ['OWNER', 'ADMIN'] } } } },
  ]
  if (user.email) {
    or.push({ invitees: { some: { email: user.email.toLowerCase(), isCoOrganizer: true } } })
  }
  return { OR: or }
}

/**
 * Load a room the caller organises, or answer 404 — the same answer whether
 * the room is missing or not theirs, so ids cannot be probed.
 */
async function organisedRoom(
  req: Request,
  res: Response
): Promise<{ room: Room; role: Role; asStaff: boolean } | null> {
  const room = await prisma.room.findUnique({ where: { id: req.params.roomId } }).catch(() => null)
  const role = room ? await getRole(room.id, req.user!.id) : null
  if (room && (role === 'OWNER' || role === 'ADMIN')) return { room, role, asStaff: false }
  // Platform administrators edit any room with the owner's powers (title, type,
  // participants, co-organizers). Editing only: their moderation rights during
  // a session are unchanged.
  if (room && req.user!.isStaff) return { room, role: 'OWNER', asStaff: true }
  res.status(404).json({ detail: 'Salle introuvable.' })
  return null
}

const roomUrl = (slug: string | null, id: string) =>
  `${env.APP_BASE_URL.replace(/\/$/, '')}/${slug ?? id}`

/** Invitee rows, with the account name of those who already signed in once. */
async function serializeInvitees(roomId: string) {
  const invitees = await prisma.roomInvitee.findMany({
    where: { roomId },
    orderBy: [{ isCoOrganizer: 'desc' }, { email: 'asc' }],
  })
  const emails = invitees.map((i) => i.email)
  // Account emails are stored as SenID sends them; compare lowercased.
  const accounts = emails.length
    ? await prisma.$queryRaw<{ email: string; full_name: string | null }[]>(Prisma.sql`
        SELECT lower(email) AS email, "fullName" AS full_name
        FROM users WHERE lower(email) IN (${Prisma.join(emails)})`)
    : []
  const nameByEmail = new Map(accounts.map((a) => [a.email, a.full_name]))
  return invitees.map((i) => ({
    id: i.id,
    email: i.email,
    is_co_organizer: i.isCoOrganizer,
    has_account: nameByEmail.has(i.email),
    full_name: nameByEmail.get(i.email) ?? null,
    created_at: i.createdAt.toISOString(),
  }))
}

/** GET / — the rooms I organise, most recently used first. */
myRoomsRouter.get('/', async (req, res) => {
  const user = req.user!
  const { page, pageSize, skip, take } = paging(req.query)
  const where = organisedRoomsWhere(user)
  const [count, rooms] = await Promise.all([
    prisma.room.count({ where }),
    prisma.room.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      include: {
        accesses: { where: { userId: user.id }, select: { role: true } },
        sessions: { orderBy: { startedAt: 'desc' }, take: 1, select: { startedAt: true, endedAt: true } },
        _count: { select: { invitees: true, sessions: true } },
      },
    }),
  ])
  res.json(
    paginated(
      count,
      page,
      pageSize,
      rooms.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug ?? r.id,
        url: roomUrl(r.slug, r.id),
        access_level: String(r.accessLevel).toLowerCase(),
        // No RoomAccess row means the standing comes from the co-organizer list.
        my_role: r.accesses[0]?.role === 'OWNER' ? 'owner' : 'co_organizer',
        invitees_count: r._count.invitees,
        sessions_count: r._count.sessions,
        last_session_at: r.sessions[0]?.startedAt.toISOString() ?? null,
        is_active: !!r.sessions[0] && r.sessions[0].endedAt === null,
        created_at: r.createdAt.toISOString(),
      }))
    )
  )
})

/** POST / — create a room (title + access type) without starting a session. */
myRoomsRouter.post('/', async (req, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      access_level: z.enum(ACCESS_LEVELS).default('public'),
    })
    .safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ detail: 'Titre ou type de salle invalide.' })

  // Collisions are astronomically unlikely (26^10), but a retry costs nothing.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const room = await prisma.room.create({
        data: {
          name: parsed.data.name,
          slug: generateRoomSlug(),
          accessLevel: parsed.data.access_level.toUpperCase() as Room['accessLevel'],
          accesses: { create: { userId: req.user!.id, role: 'OWNER' } },
        },
      })
      return res.status(201).json({ id: room.id, slug: room.slug, name: room.name })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue
      throw err
    }
  }
  res.status(503).json({ detail: 'Impossible de générer un lien, réessayez.' })
})

/** GET /:roomId/ — one of my rooms, with its participant list. */
myRoomsRouter.get('/:roomId/', async (req, res) => {
  const found = await organisedRoom(req, res)
  if (!found) return
  const { room, role, asStaff } = found
  const owner = await prisma.roomAccess.findFirst({
    where: { roomId: room.id, role: 'OWNER' },
    include: { user: { select: { fullName: true, email: true } } },
  })
  res.json({
    id: room.id,
    name: room.name,
    slug: room.slug ?? room.id,
    url: roomUrl(room.slug, room.id),
    access_level: String(room.accessLevel).toLowerCase(),
    my_role: asStaff ? 'admin' : role === 'OWNER' ? 'owner' : 'co_organizer',
    owner: owner ? { full_name: owner.user.fullName, email: owner.user.email } : null,
    invitees: await serializeInvitees(room.id),
    max_invitees: MAX_INVITEES,
    email_enabled: env.mail.enabled,
  })
})

/**
 * GET /:roomId/people/?q= — members of the platform to suggest as
 * participants, as the organiser types a name or an address.
 *
 * Only organisers of the room may search, and only name + email of active
 * accounts come back — no more than the participant list itself shows. People
 * already listed, and the owner, are left out. Every word must match the name
 * or the email (accent- and case-insensitive); names starting with the first
 * word come first.
 */
myRoomsRouter.get('/:roomId/people/', searchLimiter, async (req, res) => {
  const found = await organisedRoom(req, res)
  if (!found) return
  const terms = searchTerms(String(req.query.q ?? ''))
  if (!terms.length) return res.json({ results: [] })

  const foldedName = Prisma.sql`translate(lower(coalesce(u."fullName", '')), ${FOLD_FROM}, ${FOLD_TO})`
  const matches = terms.map(
    (t) => Prisma.sql`(${foldedName} LIKE ${'%' + t + '%'} OR lower(u.email) LIKE ${'%' + t + '%'})`
  )
  const rows = await prisma.$queryRaw<{ id: string; full_name: string | null; email: string }[]>(Prisma.sql`
    SELECT u.id, u."fullName" AS full_name, u.email
    FROM users u
    WHERE u."isActive" AND u.email IS NOT NULL
      AND lower(u.email) NOT IN (SELECT email FROM room_invitees WHERE "roomId" = ${found.room.id})
      AND u.id NOT IN (
        SELECT "userId" FROM room_accesses WHERE "roomId" = ${found.room.id} AND role = 'OWNER'
      )
      AND ${Prisma.join(matches, ' AND ')}
    ORDER BY (${foldedName} LIKE ${terms[0] + '%'}) DESC, u."fullName" ASC NULLS LAST
    LIMIT 8`)
  res.json({ results: rows.map((r) => ({ id: r.id, full_name: r.full_name, email: r.email.toLowerCase() })) })
})

/** POST /:roomId/invitees/ — add addresses (a pasted list is fine). */
myRoomsRouter.post('/:roomId/invitees/', async (req, res) => {
  const found = await organisedRoom(req, res)
  if (!found) return
  const body = z
    .object({
      emails: z.union([z.string(), z.array(z.string())]),
      is_co_organizer: z.boolean().default(false),
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ detail: 'Liste d’adresses invalide.' })
  // Only the owner hands out moderation rights.
  if (body.data.is_co_organizer && found.role !== 'OWNER') {
    return res.status(403).json({ detail: 'Seul le propriétaire peut désigner des co-organisateurs.' })
  }

  const { valid, invalid } = parseEmailList(body.data.emails)
  const existing = await prisma.roomInvitee.findMany({
    where: { roomId: found.room.id },
    select: { email: true },
  })
  const known = new Set(existing.map((e) => e.email))
  const fresh = valid.filter((e) => !known.has(e))
  if (existing.length + fresh.length > MAX_INVITEES) {
    return res.status(400).json({
      detail: `Une salle compte au plus ${MAX_INVITEES} participants prévus.`,
    })
  }

  await prisma.roomInvitee.createMany({
    data: fresh.map((email) => ({
      roomId: found.room.id,
      email,
      isCoOrganizer: body.data.is_co_organizer,
      invitedById: req.user!.id,
    })),
    skipDuplicates: true,
  })
  res.status(201).json({
    added: fresh,
    already_listed: valid.filter((e) => known.has(e)),
    invalid,
    invitees: await serializeInvitees(found.room.id),
  })
})

/** PATCH /:roomId/invitees/:inviteeId/ — grant or withdraw co-organizer (owner only). */
myRoomsRouter.patch('/:roomId/invitees/:inviteeId/', async (req, res) => {
  const found = await organisedRoom(req, res)
  if (!found) return
  if (found.role !== 'OWNER') {
    return res.status(403).json({ detail: 'Seul le propriétaire peut désigner des co-organisateurs.' })
  }
  const body = z.object({ is_co_organizer: z.boolean() }).safeParse(req.body)
  if (!body.success) return res.status(400).json({ detail: 'Requête invalide.' })
  const { count } = await prisma.roomInvitee.updateMany({
    where: { id: req.params.inviteeId, roomId: found.room.id },
    data: { isCoOrganizer: body.data.is_co_organizer },
  })
  if (!count) return res.status(404).json({ detail: 'Participant introuvable.' })
  res.json({ invitees: await serializeInvitees(found.room.id) })
})

/** DELETE /:roomId/invitees/:inviteeId/ — remove someone from the list. */
myRoomsRouter.delete('/:roomId/invitees/:inviteeId/', async (req, res) => {
  const found = await organisedRoom(req, res)
  if (!found) return
  const invitee = await prisma.roomInvitee.findFirst({
    where: { id: req.params.inviteeId, roomId: found.room.id },
  })
  if (!invitee) return res.status(404).json({ detail: 'Participant introuvable.' })
  // A co-organizer may tidy the list, but not remove a fellow co-organizer.
  if (invitee.isCoOrganizer && found.role !== 'OWNER') {
    return res.status(403).json({ detail: 'Seul le propriétaire peut retirer un co-organisateur.' })
  }
  await prisma.roomInvitee.delete({ where: { id: invitee.id } })
  res.json({ invitees: await serializeInvitees(found.room.id) })
})

/** POST /:roomId/invite-all/ — email the link to everyone on the list. */
myRoomsRouter.post('/:roomId/invite-all/', inviteLimiter, async (req, res) => {
  const found = await organisedRoom(req, res)
  if (!found) return
  if (!env.mail.enabled) {
    return res.status(503).json({ detail: "L'envoi d'emails n'est pas configuré." })
  }
  const message = z.string().trim().max(2000).optional().safeParse(req.body?.message)
  if (!message.success) return res.status(400).json({ detail: 'Message trop long.' })

  const recipients = (
    await prisma.roomInvitee.findMany({ where: { roomId: found.room.id }, select: { email: true } })
  ).map((i) => i.email)
  if (!recipients.length) return res.status(400).json({ detail: 'La liste des participants est vide.' })

  const url = roomUrl(found.room.slug, found.room.id)
  const inviter = req.user!.fullName || req.user!.email || 'Un organisateur'
  const content = { inviter, url, roomLabel: found.room.name, customMessage: message.data || undefined }
  const mail = {
    subject: `${inviter} vous invite à la réunion « ${found.room.name} »`,
    text: buildText(content),
    html: buildHtml(content),
  }

  // A few at a time: up to 300 recipients must not open 300 SMTP sessions at once.
  const failed: string[] = []
  for (let i = 0; i < recipients.length; i += 5) {
    const batch = recipients.slice(i, i + 5)
    const results = await Promise.allSettled(batch.map((to) => sendMail({ to, ...mail })))
    results.forEach((r, j) => {
      if (r.status === 'rejected') {
        failed.push(batch[j])
        logger.warn(`[my-rooms] invitation to ${batch[j]} failed: ${String(r.reason)}`)
      }
    })
  }
  const sent = recipients.length - failed.length
  if (!sent) return res.status(502).json({ detail: "L'envoi des invitations a échoué.", sent, failed })
  res.json({ sent, failed })
})
