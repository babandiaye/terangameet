import { describe, expect, it } from 'vitest'
import { LOBBY_STALE_MS, splitWaiting } from './lobbyEntries'

const now = 1_000_000
const entry = (id: string, status: 'waiting' | 'accepted' | 'denied', seenAgoMs: number, createdAgoMs = seenAgoMs) => ({
  id,
  username: id,
  color: '#000',
  status,
  createdAt: now - createdAgoMs,
  lastSeenAt: now - seenAgoMs,
})

describe('splitWaiting', () => {
  it('lists people still asking, oldest request first', () => {
    const { waiting } = splitWaiting([entry('b', 'waiting', 1000, 5000), entry('a', 'waiting', 2000, 9000)], now)
    expect(waiting.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('drops a request whose browser stopped asking (tab closed)', () => {
    const { waiting, stale } = splitWaiting(
      [entry('here', 'waiting', 1000), entry('gone', 'waiting', LOBBY_STALE_MS + 1)],
      now
    )
    expect(waiting.map((e) => e.id)).toEqual(['here'])
    expect(stale).toEqual(['gone'])
  })

  it('keeps a background tab, which only asks about once a minute', () => {
    const { waiting } = splitWaiting([entry('slow', 'waiting', 65_000)], now)
    expect(waiting.map((e) => e.id)).toEqual(['slow'])
  })

  it('reads entries saved before lastSeenAt existed by their creation time', () => {
    const old = { ...entry('legacy', 'waiting', 0), lastSeenAt: undefined, createdAt: now - LOBBY_STALE_MS - 1 }
    expect(splitWaiting([old], now).stale).toEqual(['legacy'])
  })

  it('ignores answered requests', () => {
    const { waiting, stale } = splitWaiting([entry('ok', 'accepted', 999_999), entry('no', 'denied', 999_999)], now)
    expect(waiting).toEqual([])
    expect(stale).toEqual([])
  })
})
