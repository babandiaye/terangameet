import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { logger } from '../lib/logger'
import { egressClient, roomService } from '../livekit/client'
import { recordingVerdict, sessionEnd } from '../lib/reconcile'

/**
 * Catch up with LiveKit when a webhook was lost: recordings left « active » or
 * « stopping » (one blocks every new recording of its room) and sessions left
 * « in progress » are compared with what LiveKit actually runs. Every 10 min,
 * under a Redis lock so several instances never do it twice. If LiveKit cannot
 * be reached, nothing is changed.
 */
const EVERY_MS = 10 * 60_000
const LOCK_KEY = 'lock:livekit-reconcile'

export async function reconcileWithLiveKit(now = new Date()): Promise<{ recordings: number; sessions: number }> {
  let recordings = 0
  let sessions = 0

  const pending = await prisma.recording.findMany({
    where: { status: { in: ['INITIATED', 'ACTIVE', 'STOPPING'] }, updatedAt: { lt: new Date(now.getTime() - 2 * 60_000) } },
    select: { id: true, status: true, workerId: true, updatedAt: true },
  })
  for (const rec of pending) {
    const egress = rec.workerId ? ((await egressClient.listEgress({ egressId: rec.workerId }))[0] ?? null) : null
    const verdict = recordingVerdict(rec, egress, now)
    if (!verdict) continue
    await prisma.recording.updateMany({ where: { id: rec.id, status: rec.status }, data: { status: verdict } })
    recordings += 1
    logger.warn(`[reconcile] recording ${rec.id}: ${rec.status} → ${verdict}`)
  }

  const open = await prisma.meetingSession.findMany({
    where: { endedAt: null, startedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
    select: { id: true, livekitRoomName: true, startedAt: true, participants: { select: { lastLeftAt: true } } },
  })
  if (open.length) {
    const live = new Set((await roomService.listRooms([...new Set(open.map((s) => s.livekitRoomName))])).map((r) => r.name))
    for (const s of open) {
      if (live.has(s.livekitRoomName)) continue
      const end = sessionEnd(s.startedAt, s.participants.map((p) => p.lastLeftAt), now)
      await prisma.meetingSession.updateMany({ where: { id: s.id, endedAt: null }, data: end })
      sessions += 1
      logger.warn(`[reconcile] session ${s.id} closed (room ${s.livekitRoomName} no longer on LiveKit)`)
    }
  }
  return { recordings, sessions }
}

export function startReconcileScheduler(): () => void {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      if (!(await redis.set(LOCK_KEY, '1', 'PX', EVERY_MS - 30_000, 'NX'))) return
      const r = await reconcileWithLiveKit()
      if (r.recordings || r.sessions) logger.info(`[reconcile] ${r.recordings} recording(s), ${r.sessions} session(s) fixed`)
    } catch (err) {
      logger.warn(`[reconcile] skipped: ${(err as Error).message}`)
    } finally {
      running = false
    }
  }
  const first = setTimeout(tick, 60_000)
  const timer = setInterval(tick, EVERY_MS)
  return () => {
    clearTimeout(first)
    clearInterval(timer)
  }
}
