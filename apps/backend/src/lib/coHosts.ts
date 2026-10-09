/**
 * Who co-hosts a scheduled meeting after a change, and what that changes for
 * the room: a co-host is a co-organizer of the meeting's room, so gaining or
 * losing the role is mirrored there.
 *
 * - Only guests can be co-hosts (an address not invited is ignored).
 * - `requested` absent means "leave the co-hosts as they are" — minus anyone
 *   no longer invited, who loses the role with their invitation.
 */
export function coHostPlan(opts: {
  guests: string[]
  requested: string[] | undefined
  current: string[]
}): { coHosts: string[]; promoted: string[]; demoted: string[] } {
  const guests = new Set(opts.guests.map((e) => e.toLowerCase()))
  const wanted = (opts.requested ?? opts.current).map((e) => e.toLowerCase())
  const coHosts = [...new Set(wanted)].filter((e) => guests.has(e))
  const current = new Set(opts.current.map((e) => e.toLowerCase()))
  return {
    coHosts,
    promoted: coHosts.filter((e) => !current.has(e)),
    demoted: [...current].filter((e) => !coHosts.includes(e)),
  }
}
