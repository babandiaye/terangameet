import { readFile } from 'node:fs/promises'
import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { getS3, s3Configured } from '../lib/s3'
import { roomService, egressClient } from '../livekit/client'
import { env } from '../config/env'
import { verifyMailer } from '../lib/mailer'
import { probe, disabled, type ComponentHealth } from '../lib/probe'
import { backupHealth, type BackupRunStatus } from '../lib/backupStatus'

export type { ComponentHealth, HealthStatus } from '../lib/probe'

/** Redis key updated by the webhook handler on every verified LiveKit event. */
export const LAST_WEBHOOK_KEY = 'health:last_webhook'

async function checkPostgres(): Promise<ComponentHealth> {
  return probe('postgresql', 'PostgreSQL', async () => {
    await prisma.$queryRaw`SELECT 1`
    return 'Base de données joignable'
  })
}

async function checkRedis(): Promise<ComponentHealth> {
  return probe('redis', 'Redis', async () => {
    const pong = await redis.ping()
    return pong === 'PONG' ? 'PING/PONG OK' : `réponse: ${pong}`
  })
}

async function checkLivekit(): Promise<ComponentHealth> {
  return probe('livekit', 'LiveKit', async () => {
    const rooms = await roomService.listRooms()
    return `API joignable · ${rooms.length} salle(s) active(s)`
  })
}

async function checkEgress(): Promise<ComponentHealth> {
  if (!env.recording.enabled) return disabled('egress', 'Egress (enregistrement)', 'Enregistrement désactivé')
  return probe('egress', 'Egress (enregistrement)', async () => {
    const list = await egressClient.listEgress({})
    const active = (list ?? []).filter((e) => String(e.status).includes('ACTIVE')).length
    return `Service joignable · ${active} egress actif(s)`
  })
}

async function checkMinio(): Promise<ComponentHealth> {
  if (!s3Configured()) return disabled('minio', 'MinIO / S3', 'Stockage non configuré')
  return probe('minio', 'MinIO / S3', async () => {
    await getS3().send(new HeadBucketCommand({ Bucket: env.recording.bucket }))
    return `Bucket « ${env.recording.bucket} » accessible`
  })
}

// The university's mail server takes ~10 s to greet (anti-spam delay): a 3 s
// probe reported it down while emails were going out fine. Generous timeout,
// and the answer is kept 5 minutes so the status page (refreshed every 10 s)
// does not wait on it each time.
const SMTP_TIMEOUT_MS = 20_000
const SMTP_CACHE_MS = 5 * 60_000
let smtpCache: { at: number; result: ComponentHealth } | null = null

async function checkSmtp(): Promise<ComponentHealth> {
  if (!env.mail.enabled) return disabled('smtp', 'SMTP (emails)', "Envoi d'emails désactivé")
  if (smtpCache && Date.now() - smtpCache.at < SMTP_CACHE_MS) return smtpCache.result
  const result = await probe(
    'smtp',
    'SMTP (emails)',
    async () => {
      await verifyMailer()
      return `Serveur ${env.mail.host}:${env.mail.port} joignable`
    },
    SMTP_TIMEOUT_MS
  )
  smtpCache = { at: Date.now(), result }
  return result
}

/** Webhook is inbound (LiveKit → us): we report the last received signed event. */
async function checkWebhook(): Promise<ComponentHealth> {
  const start = Date.now()
  try {
    const raw = await redis.get(LAST_WEBHOOK_KEY)
    if (!raw) {
      return {
        key: 'webhook',
        label: 'Webhook LiveKit',
        status: 'unknown',
        latencyMs: Date.now() - start,
        detail: 'Aucun événement reçu pour l’instant',
      }
    }
    const { at, event } = JSON.parse(raw) as { at: number; event?: string }
    const ageMs = Date.now() - at
    const mins = Math.round(ageMs / 60000)
    const ago = mins < 1 ? "à l'instant" : mins < 60 ? `il y a ${mins} min` : `il y a ${Math.round(mins / 60)} h`
    // Reception depends on meeting activity, so a quiet period is not a failure.
    return {
      key: 'webhook',
      label: 'Webhook LiveKit',
      status: 'ok',
      latencyMs: Date.now() - start,
      detail: `Dernier événement (${event ?? '—'}) ${ago}`,
    }
  } catch {
    return { key: 'webhook', label: 'Webhook LiveKit', status: 'unknown', latencyMs: Date.now() - start, detail: 'Indéterminé' }
  }
}

/** Written by the nightly backup (deploy/backup/terangameetv2-backup.sh). */
const BACKUP_STATUS_FILE = process.env.BACKUP_STATUS_FILE || '/var/lib/terangameetv2/backup-status.json'

/** Last nightly backup: verified by a test restore, and not older than 26 h. */
async function checkBackup(): Promise<ComponentHealth> {
  const start = Date.now()
  let status: BackupRunStatus | null = null
  try {
    status = JSON.parse(await readFile(BACKUP_STATUS_FILE, 'utf8')) as BackupRunStatus
  } catch {
    status = null // never ran yet (or unreadable)
  }
  return { key: 'backup', label: 'Sauvegarde de la base', latencyMs: Date.now() - start, ...backupHealth(status, Date.now()) }
}

/** Probe every infrastructure dependency in parallel. */
export async function checkAll(): Promise<{ checkedAt: string; components: ComponentHealth[] }> {
  const components = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkLivekit(),
    checkEgress(),
    checkMinio(),
    checkSmtp(),
    checkWebhook(),
    checkBackup(),
  ])
  return { checkedAt: new Date().toISOString(), components }
}
