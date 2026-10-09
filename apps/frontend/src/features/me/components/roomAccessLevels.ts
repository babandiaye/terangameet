import type { RoomAccessLevel } from '../api/types'
import { ApiError } from '@/api/ApiError'

/**
 * The three access types, worded for organisers. Mirrors the server rule in
 * apps/backend/src/lib/roomAccess.ts — change both together.
 */
export const ACCESS_LEVELS: {
  value: RoomAccessLevel
  label: string
  short: string
  description: string
}[] = [
  {
    value: 'public',
    label: 'Ouverte',
    short: 'Ouverte',
    description: 'Toute personne disposant du lien entre directement.',
  },
  {
    value: 'trusted',
    label: 'Personnes de confiance',
    short: 'Confiance',
    description:
      'Les personnes connectées avec leur compte entrent directement ; les invités sans compte attendent d’être admis.',
  },
  {
    value: 'restricted',
    label: 'Restreinte',
    short: 'Restreinte',
    description:
      'Seuls l’organisateur, les co-organisateurs et les participants prévus entrent directement ; les autres attendent d’être admis.',
  },
]

export const accessLevelLabel = (value: RoomAccessLevel) =>
  ACCESS_LEVELS.find((l) => l.value === value)?.short ?? value

/** The server's `detail` message when there is one, else a generic sentence. */
export const errorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof ApiError) {
    const detail = (err.body as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string' && detail) return detail
    if (err.statusCode === 429)
      return 'Trop de demandes : réessayez dans quelques minutes.'
  }
  return fallback
}
