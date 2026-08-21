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
