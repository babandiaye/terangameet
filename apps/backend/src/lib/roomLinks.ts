import { env } from '../config/env'

/** The public link of a room: <APP_BASE_URL>/<slug>, or its id when it has no slug. */
export function roomUrlFrom(baseUrl: string, room: { slug?: string | null; id: string }): string {
  return `${baseUrl.replace(/\/$/, '')}/${room.slug ?? room.id}`
}

/**
 * The link people are given (invitations, calendars, history). One place for
 * it: the day its format changes, every email and every API answer follow.
 */
export const roomUrl = (room: { slug?: string | null; id: string }) => roomUrlFrom(env.APP_BASE_URL, room)
