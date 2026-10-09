import type { Role, RoomAccessLevel } from '@prisma/client'

/**
 * How someone arriving at a registered room gets in: straight away with a
 * LiveKit token, or through the waiting room where a moderator admits them.
 *
 * Kept pure (no database, no request) so the access rules can be tested on
 * their own — they are the product's promise to room owners:
 *   - public:     anyone joins;
 *   - trusted:    signed-in people join, guests wait to be admitted;
 *   - restricted: only the room's people join — owner, co-organizers and the
 *                 listed participants — everyone else waits.
 * A standing on the room (any role) always lets its holder in.
 */
export function entryDecision(opts: {
  accessLevel: RoomAccessLevel
  isAuthenticated: boolean
  role: Role | null
}): 'direct' | 'lobby' {
  if (opts.role) return 'direct'
  switch (opts.accessLevel) {
    case 'PUBLIC':
      return 'direct'
    case 'TRUSTED':
      return opts.isAuthenticated ? 'direct' : 'lobby'
    default:
      return 'lobby'
  }
}

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
