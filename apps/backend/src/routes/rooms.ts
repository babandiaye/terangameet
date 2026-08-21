import { Router, type Request } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { env } from '../config/env'
import { logger } from '../lib/logger'
import { requireAuth } from '../auth/middleware'
import { generateLiveKitToken } from '../livekit/token'
import { slugify, isUuid } from '../utils/slug'
import {
  getRole,
  isAdminOrOwner,
  serializeRoom,
  serializeEphemeralRoom,
  publishableSources,
  type RoomConfiguration,
} from '../services/rooms'

export const roomsRouter = Router()

/** Stable participant identity: OIDC sub for users, a per-session id for guests. */
function participantIdentity(req: Request): string {
  if (req.user) return req.user.sub || req.user.id
  if (!req.session.anonId) req.session.anonId = randomUUID()
  return `anon-${req.session.anonId}`
}

function displayName(req: Request, username?: string): string {
  return (
    (username && username.trim()) ||
    req.user?.fullName ||
    req.user?.email ||
    'Invité'
  )
}

const CALLBACK_PREFIX = 'room_creation_callback:'

/** POST /api/v1.0/rooms/creation-callback/ — retrieve a cached room creation result. */
roomsRouter.post('/creation-callback/', async (req, res) => {
  const callbackId = String(req.body?.callback_id ?? '')
  if (!callbackId) return res.status(400).json({ detail: 'callback_id is required.' })
  const raw = await redis.get(CALLBACK_PREFIX + callbackId)
  if (!raw) return res.status(404).json({ status: 'pending' })
  res.json({ status: 'success', room: JSON.parse(raw) })
})

/** POST /api/v1.0/rooms/?username= — create a persistent room (auth required). */
roomsRouter.post('/', requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(500),
    callback_id: z.string().optional(),
    access_level: z.enum(['public', 'trusted', 'restricted']).optional(),
    configuration: z.record(z.any()).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ detail: 'Invalid payload', errors: parsed.error.flatten() })
  }
  const { name, callback_id, access_level, configuration } = parsed.data
  const username = req.query.username as string | undefined

  const slug = slugify(name) || randomUUID().slice(0, 8)

  // Reuse an existing room with the same slug owned by anyone, else create.
  // Two concurrent creates can both see "no room"; the unique slug constraint
  // makes the loser fail with P2002 — we then just re-fetch the winner's room.
  let room = await prisma.room.findUnique({ where: { slug } })
  if (!room) {
    try {
      room = await prisma.room.create({
        data: {
          name,
          slug,
          accessLevel: (access_level?.toUpperCase() as never) ?? (env.rooms.defaultAccessLevel.toUpperCase() as never),
          configuration: (configuration ?? {}) as object,
          accesses: { create: { userId: req.user!.id, role: 'OWNER' } },
        },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        room = await prisma.room.findUnique({ where: { slug } })
      }
      if (!room) throw err
    }
  }

  const role = await getRole(room.id, req.user!.id)
  const admin = isAdminOrOwner(role)
  const token = await generateLiveKitToken({
    room: room.id,
    identity: participantIdentity(req),
    name: displayName(req, username),
    sources: publishableSources(room.configuration as RoomConfiguration),
    isAdminOrOwner: admin,
  })

  const payload = serializeRoom(room, {
    isAdministrable: admin,
    livekit: { url: env.livekit.wsUrl, room: room.id, token },
  })

  if (callback_id) {
    await redis.set(CALLBACK_PREFIX + callback_id, JSON.stringify(payload), 'EX', 600)
  }

  res.status(201).json(payload)
})

/** GET /api/v1.0/rooms/:roomId?username= — join/get a room (+ LiveKit token). */
roomsRouter.get('/:roomId', async (req, res) => {
  const roomId = req.params.roomId
  const username = req.query.username as string | undefined

  const room = await prisma.room.findFirst({
    where: isUuid(roomId) ? { OR: [{ id: roomId }, { slug: roomId }] } : { slug: roomId },
  })

  // Unregistered room: allow ad-hoc joining if enabled.
  if (!room) {
    if (!env.rooms.allowUnregistered) {
      return res.status(404).json({ detail: 'Room not found.' })
    }
    const token = await generateLiveKitToken({
      room: roomId,
      identity: participantIdentity(req),
      name: displayName(req, username),
      sources: env.livekit.defaultSources,
      isAdminOrOwner: true, // no owner exists for ad-hoc rooms
    })
    return res.json(
      serializeEphemeralRoom(roomId, {
        isAdministrable: true,
        livekit: { url: env.livekit.wsUrl, room: roomId, token },
      })
    )
  }

  const role = await getRole(room.id, req.user?.id)
  const admin = isAdminOrOwner(role)

  // Access control.
  if (room.accessLevel === 'TRUSTED' && !req.user) {
    return res.status(401).json({ detail: 'Authentication required for this room.' })
  }
  if (room.accessLevel === 'RESTRICTED' && !admin) {
    // The frontend will fall back to the lobby (request-entry) flow.
    return res.json(serializeRoom(room, { isAdministrable: false }))
  }

  const token = await generateLiveKitToken({
    room: room.id,
    identity: participantIdentity(req),
    name: displayName(req, username),
    sources: publishableSources(room.configuration as RoomConfiguration),
    isAdminOrOwner: admin,
  })

  res.json(
    serializeRoom(room, {
      isAdministrable: admin,
      livekit: { url: env.livekit.wsUrl, room: room.id, token },
    })
  )
})

/** PATCH /api/v1.0/rooms/:roomId — update room (admins/owners). */
roomsRouter.patch('/:roomId', requireAuth, async (req, res) => {
  const room = await prisma.room.findFirst({
    where: isUuid(req.params.roomId) ? { id: req.params.roomId } : { slug: req.params.roomId },
  })
  if (!room) return res.status(404).json({ detail: 'Room not found.' })
  const role = await getRole(room.id, req.user!.id)
  if (!isAdminOrOwner(role)) return res.status(403).json({ detail: 'Insufficient privileges.' })

  const schema = z.object({
    name: z.string().min(1).max(500).optional(),
    access_level: z.enum(['public', 'trusted', 'restricted']).optional(),
    configuration: z.record(z.any()).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ detail: 'Invalid payload' })

  const updated = await prisma.room.update({
    where: { id: room.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.access_level
        ? { accessLevel: parsed.data.access_level.toUpperCase() as never }
        : {}),
      ...(parsed.data.configuration ? { configuration: parsed.data.configuration as object } : {}),
    },
  })
  res.json(serializeRoom(updated, { isAdministrable: true }))
})

/** DELETE /api/v1.0/rooms/:roomId — owner only. */
roomsRouter.delete('/:roomId', requireAuth, async (req, res) => {
  const room = await prisma.room.findFirst({
    where: isUuid(req.params.roomId) ? { id: req.params.roomId } : { slug: req.params.roomId },
  })
  if (!room) return res.status(404).json({ detail: 'Room not found.' })
  const role = await getRole(room.id, req.user!.id)
  if (role !== 'OWNER') return res.status(403).json({ detail: 'Only the owner can delete a room.' })
  await prisma.room.delete({ where: { id: room.id } })
  logger.info(`[rooms] deleted ${room.id}`)
  res.status(204).send()
})
