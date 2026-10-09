/**
 * Waiting-room requests, as stored in Redis. A guest's browser re-asks every
 * second while it waits (request-entry); `lastSeenAt` records the latest ask.
 * When it stops — the tab was closed — the request is stale and leaves the
 * moderators' list instead of lingering for the hash's 6-hour expiry.
 */
export type LobbyStatus = 'waiting' | 'accepted' | 'denied'

export interface LobbyEntry {
  id: string
  username: string
  color: string
  status: LobbyStatus
  createdAt: number
  /** Last time the guest's browser asked; absent on entries saved before it existed. */
  lastSeenAt?: number
}

/**
 * Generous on purpose: a background tab asks only about once a minute, as
 * browsers throttle the timers of hidden pages.
 */
export const LOBBY_STALE_MS = 90_000

export function splitWaiting(entries: LobbyEntry[], now: number): { waiting: LobbyEntry[]; stale: string[] } {
  const waiting: LobbyEntry[] = []
  const stale: string[] = []
  for (const e of entries) {
    if (e.status !== 'waiting') continue
    if (now - (e.lastSeenAt ?? e.createdAt) > LOBBY_STALE_MS) stale.push(e.id)
    else waiting.push(e)
  }
  waiting.sort((a, b) => a.createdAt - b.createdAt)
  return { waiting, stale }
}
