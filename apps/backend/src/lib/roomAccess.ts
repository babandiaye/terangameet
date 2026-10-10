import type { Role, RoomAccessLevel } from '@prisma/client'

/**
 * How someone arriving at a registered room gets in: straight away with a
 * LiveKit token, through the waiting room where a moderator admits them, or
 * not before signing in with SENID.
 *
 * Kept pure (no database, no request) so the access rules can be tested on
 * their own — they are the product's promise to room owners:
 *   - public:       anyone joins, with just a name;
 *   - public lobby: no account needed, but everyone waits for the organizer
 *                   or a co-organizer to admit them — listed participants too;
 *   - trusted:      SENID sign-in required, then straight in;
 *   - restricted:   SENID sign-in required; listed participants join, everyone
 *                   else waits to be admitted.
 * The organizer and co-organizers (OWNER/ADMIN) always get straight in.
 */
export type EntryDecision = 'direct' | 'lobby' | 'login'

export function entryDecision(opts: {
  accessLevel: RoomAccessLevel
  isAuthenticated: boolean
  role: Role | null
}): EntryDecision {
  if (opts.role === 'OWNER' || opts.role === 'ADMIN') return 'direct'
  switch (opts.accessLevel) {
    case 'PUBLIC':
      return 'direct'
    case 'PUBLIC_LOBBY':
      return 'lobby'
    case 'TRUSTED':
      return opts.isAuthenticated ? 'direct' : 'login'
    default:
      if (!opts.isAuthenticated) return 'login'
      return opts.role ? 'direct' : 'lobby'
  }
}

/** What the API answers when a room needs a SENID sign-in first. */
export const LOGIN_REQUIRED = {
  code: 'login_required',
  detail: 'Cette réunion exige une connexion avec votre compte SENID.',
} as const

// Deliberately simple: the address is checked again by the mail server, and a
// mistyped one only means that person is not recognised.
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

/**
 * Normalise a pasted list of addresses: any mix of commas, semicolons, spaces
 * and new lines, including the "Name <address>" form a mail client copies.
 * Lowercased and de-duplicated in first-seen order; what is not an address is
 * returned apart so the caller can say so rather than drop it silently.
 */
export function parseEmailList(input: string | string[]): {
  valid: string[]
  invalid: string[]
} {
  const text = Array.isArray(input) ? input.join('\n') : input
  // "Awa Ndiaye <awa@x.sn>" → "awa@x.sn": keep only what is inside the brackets.
  const unwrapped = text.replace(/[^<>,;\n]*<([^<>]+)>/g, ' $1 ')
  const valid: string[] = []
  const invalid: string[] = []
  for (const token of unwrapped.split(/[\s,;]+/)) {
    if (!token) continue
    if (!EMAIL_RE.test(token)) {
      invalid.push(token)
      continue
    }
    const email = token.toLowerCase()
    if (!valid.includes(email)) valid.push(email)
  }
  return { valid, invalid }
}
