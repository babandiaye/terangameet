import type { HealthStatus } from './probe'

/** What deploy/backup/terangameetv2-backup.sh writes after each run. */
export interface BackupRunStatus {
  ok: boolean
  finished_at: string
  message: string
  size_bytes?: number
}

/** A nightly backup older than this is late: something stopped it. */
const MAX_AGE_HOURS = 26

const size = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`

/** The backup line of Admin → État des services, from the last run's status. */
export function backupHealth(
  status: BackupRunStatus | null,
  now: number
): { status: HealthStatus; detail: string } {
  if (!status) return { status: 'unknown', detail: 'Aucune sauvegarde effectuée pour l’instant' }
  if (!status.ok) return { status: 'down', detail: status.message }
  const finished = new Date(status.finished_at)
  const hours = Math.round((now - finished.getTime()) / 3_600_000)
  const when = finished.toLocaleString('fr-FR', { timeZone: 'Africa/Dakar', dateStyle: 'short', timeStyle: 'short' })
  if (hours > MAX_AGE_HOURS) {
    return { status: 'down', detail: `Dernière sauvegarde réussie il y a ${hours} h (${when}) : la sauvegarde nocturne ne passe plus` }
  }
  return {
    status: 'ok',
    detail: `Dernière sauvegarde vérifiée le ${when}${status.size_bytes ? ` · ${size(status.size_bytes)}` : ''}`,
  }
}
