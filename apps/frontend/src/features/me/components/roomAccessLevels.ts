import type { RoomAccessLevel } from '../api/types'
import { ApiError } from '@/api/ApiError'

/**
 * The four access types, worded for organisers. Mirrors the server rule in
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
    label: 'Publique',
    short: 'Publique',
    description:
      'Toute personne disposant du lien entre directement, en indiquant son nom.',
  },
  {
    value: 'public_lobby',
    label: 'Ouverte sur validation',
    short: 'Sur validation',
    description:
      'Pas de connexion requise, l’animateur valide chaque entrée. Seuls l’organisateur et les co-animateurs entrent sans attendre.',
  },
  {
    value: 'trusted',
    label: 'Personnes de confiance',
    short: 'Confiance',
    description:
      'Connexion SENID obligatoire, puis entrée directe. Les participants sont ainsi tous identifiés.',
  },
  {
    value: 'restricted',
    label: 'Restreinte',
    short: 'Restreinte',
    description:
      'Connexion SENID obligatoire. Les participants prévus entrent directement ; les autres attendent d’être admis.',
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
