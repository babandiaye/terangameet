import { Router, type Request } from 'express'
import { webhookReceiver, roomService } from '../livekit/client'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { env } from '../config/env'
import { onRoomStarted, onRoomFinished, onParticipant } from '../services/meetingSessions'
import { redis } from '../lib/redis'
import { LAST_WEBHOOK_KEY } from '../services/health'
import { endedStatus } from '../lib/egressStatus'

export const webhookRouter = Router()

interface RawRequest extends Request {
  rawBody?: string
}

/** POST /api/v1.0/rooms/webhooks-livekit/ — receives signed LiveKit events. */
webhookRouter.post('/webhooks-livekit/', async (req, res) => {
  const auth = req.get('Authorization') || ''
  const body = (req as RawRequest).rawBody ?? JSON.stringify(req.body)
  let event
  try {
    event = await webhookReceiver.receive(body, auth)
  } catch (err) {
    logger.warn(`[webhook] invalid signature: ${(err as Error).message}`)
    return res.status(401).json({ status: 'error' })
  }

  // Record receipt for the admin "service status" view (best-effort telemetry).
  redis
    .set(LAST_WEBHOOK_KEY, JSON.stringify({ at: Date.now(), event: event.event }))
    .catch((e) => logger.debug(`[webhook] status telemetry write failed: ${(e as Error).message}`))

  // Optional room-name filter.
  if (env.livekit.webhookFilterRegex) {
    const name = event.room?.name ?? ''
    if (!new RegExp(env.livekit.webhookFilterRegex).test(name)) {
      return res.json({ status: 'ignored' })
    }
  }

  try {
    await handleEvent(event)
  } catch (err) {
    logger.error('[webhook] handler error', err)
  }
  res.json({ status: 'success' })
})

async function handleEvent(event: {
  event: string
  room?: { sid?: string; name?: string; numParticipants?: number; creationTime?: number | bigint | string }
  participant?: { identity?: string; name?: string; joinedAt?: number | bigint | string }
  egressInfo?: { egressId?: string; roomName?: string; status?: number | string }
}) {
  switch (event.event) {
    case 'egress_started':
    case 'egress_updated': {
      const egressId = event.egressInfo?.egressId
      if (!egressId) return
      const recording = await prisma.recording.findFirst({ where: { workerId: egressId } })
      if (!recording) return
      // Don't regress an already-finalized recording.
      if (['SAVED', 'STOPPED', 'ABORTED', 'FAILED_TO_STOP'].includes(recording.status)) return
      await prisma.recording.update({ where: { id: recording.id }, data: { status: 'ACTIVE' } })
      logger.info(`[webhook] ${event.event} → recording ${recording.id} active`)
      break
    }
    case 'egress_ended': {
      const egressId = event.egressInfo?.egressId
      if (!egressId) return
      const recording = await prisma.recording.findFirst({ where: { workerId: egressId } })
      if (!recording) return
      const status = endedStatus(event.egressInfo?.status)
      await prisma.recording.update({ where: { id: recording.id }, data: { status } })
      // Clear the recording indicator now the egress has finalized.
      const roomName = event.egressInfo?.roomName || event.room?.name
      if (roomName) {
        await roomService
          .updateRoomMetadata(roomName, JSON.stringify({}))
          .catch((e) => logger.warn(`[webhook] metadata clear failed for ${roomName}: ${(e as Error).message}`))
      }
      logger.info(`[webhook] egress_ended (${event.egressInfo?.status}) → recording ${recording.id} = ${status}`)
      break
    }
    case 'room_started':
      if (event.room) await onRoomStarted(event.room)
      break
    case 'room_finished':
      if (event.room) await onRoomFinished(event.room)
      break
    case 'participant_joined':
      if (event.room) await onParticipant(event.room, event.participant ?? {}, 'joined')
      break
    case 'participant_left':
      if (event.room) await onParticipant(event.room, event.participant ?? {}, 'left')
      break
    default:
      // Acknowledged; no persistent action needed.
      break
  }
}
