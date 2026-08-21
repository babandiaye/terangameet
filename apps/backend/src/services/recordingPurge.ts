import { Prisma, type RecordingStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { deleteObject } from '../lib/s3'
import { env } from '../config/env'
import { logger } from '../lib/logger'

/** Allowed retention periods → number of months. */
export const PURGE_PERIODS: Record<string, number> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
  '1y': 12,
}

const REDIS_PERIOD_KEY = 'purge:period'
const PURGE_BATCH = 500

function normalizePeriod(value: string | null | undefined): string {
  if (value && value in PURGE_PERIODS) return value
  if (env.purge.defaultPeriod in PURGE_PERIODS) return env.purge.defaultPeriod
  return '6m'
}

/** Effective retention period (admin override in Redis, else env default). */
export async function getPurgePeriod(): Promise<string> {
  try {
    return normalizePeriod(await redis.get(REDIS_PERIOD_KEY))
  } catch {
    return normalizePeriod(env.purge.defaultPeriod)
  }
}

export async function setPurgePeriod(period: string): Promise<string> {
  const normalized = normalizePeriod(period)
  await redis.set(REDIS_PERIOD_KEY, normalized)
  return normalized
}

/** Cutoff date: recordings created before this are eligible for purge. */
function cutoffDate(period: string): Date {
  const months = PURGE_PERIODS[normalizePeriod(period)]
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d
}

const eligibleWhere = (cutoff: Date): Prisma.RecordingWhereInput => ({
  createdAt: { lt: cutoff },
  status: { notIn: ['INITIATED', 'ACTIVE'] as RecordingStatus[] },
})

/** Object key inside the recordings bucket (mirrors recording.ts). */
function recordingKey(r: { id: string; mode: string }): string {
  const ext = r.mode === 'TRANSCRIPT' ? 'ogg' : 'mp4'
  return `${env.recording.outputFolder}/${r.id}.${ext}`
}

/** How many recordings would be purged at the current/given period. */
export async function countEligible(period?: string): Promise<number> {
  const p = period ?? (await getPurgePeriod())
  return prisma.recording.count({ where: eligibleWhere(cutoffDate(p)) })
}

/**
 * Delete recordings older than the retention period: removes the stored file
 * from MinIO (best-effort) then the DB row. Returns how many were deleted.
 */
export async function purgeRecordings(period?: string): Promise<number> {
  const p = period ?? (await getPurgePeriod())
  const cutoff = cutoffDate(p)
  const recordings = await prisma.recording.findMany({
    where: eligibleWhere(cutoff),
    take: PURGE_BATCH,
    select: { id: true, mode: true },
  })
  if (recordings.length === 0) return 0

  let deleted = 0
  for (const r of recordings) {
    await deleteObject(recordingKey(r), env.recording.bucket).catch((e) =>
      logger.warn(`[purge] object delete failed for ${r.id}: ${(e as Error).message}`)
    )
    await prisma.recording.delete({ where: { id: r.id } })
    deleted++
  }
  logger.info(`[purge] removed ${deleted} recording(s) older than ${p} (cutoff ${cutoff.toISOString()})`)
  return deleted
}

let timer: ReturnType<typeof setInterval> | null = null
let running = false

/** Run the purge once, guarding against overlapping executions. */
async function runOnce() {
  if (running) return
  running = true
  try {
    await purgeRecordings()
  } catch (err) {
    logger.error('[purge] run failed', err)
  } finally {
    running = false
  }
}

/**
 * Start the daily purge scheduler when the feature is enabled. Runs shortly
 * after boot, then every 24h. No-op (and returns a cleanup) when disabled.
 */
export function startPurgeScheduler(): () => void {
  if (!env.purge.enabled) {
    logger.info('[purge] disabled (PURGE_RECORDINGS_ENABLED=false)')
    return () => {}
  }
  logger.info(`[purge] scheduler enabled · default period ${env.purge.defaultPeriod}`)
  const kickoff = setTimeout(runOnce, 60_000) // first sweep 1 min after boot
  timer = setInterval(runOnce, 24 * 60 * 60 * 1000)
  return () => {
    clearTimeout(kickoff)
    if (timer) clearInterval(timer)
  }
}
