import { randomInt } from 'node:crypto'

/** Slugify a room name the way the frontend expects (lowercase, dash-separated). */
export function slugify(input: string): string {
  return input
    .toString()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

const ROOM_ID_RE = /^[a-zA-Z0-9_-]+$/

export function isValidRoomId(id: string): boolean {
  return ROOM_ID_RE.test(id)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(id: string): boolean {
  return UUID_RE.test(id)
}

const SLUG_LETTERS = 'abcdefghijklmnopqrstuvwxyz'

/**
 * A room link in the Google Meet shape the frontend generates (abc-defg-hij),
 * for rooms created server-side without starting a session.
 */
export function generateRoomSlug(): string {
  // randomInt draws without modulo bias: links of public rooms are their only
  // protection, so every letter must be equally likely.
  const segment = (n: number) =>
    Array.from({ length: n }, () => SLUG_LETTERS[randomInt(SLUG_LETTERS.length)]).join('')
  return [segment(3), segment(4), segment(3)].join('-')
}
