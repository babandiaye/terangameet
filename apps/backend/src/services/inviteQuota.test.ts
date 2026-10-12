import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, number>()
vi.mock('../lib/redis', () => ({
  redis: {
    incrby: async (k: string, n: number) => {
      store.set(k, (store.get(k) ?? 0) + n)
      return store.get(k)!
    },
    decrby: async (k: string, n: number) => {
      store.set(k, (store.get(k) ?? 0) - n)
      return store.get(k)!
    },
    expire: async () => 1,
  },
}))
vi.mock('../config/env', () => ({ env: { mail: { dailyRecipientQuota: 10 } } }))

const { quotaKey, reserveInvitations } = await import('./inviteQuota')
const member = { id: 'u1', isStaff: false }

describe('reserveInvitations', () => {
  beforeEach(() => store.clear())

  it('keys the counter per account and per UTC day', () => {
    expect(quotaKey('u1', new Date('2026-10-11T23:30:00Z'))).toBe('invite_quota:u1:2026-10-11')
  })

  it('accepts recipients within the daily budget', async () => {
    expect(await reserveInvitations(member, 6)).toEqual({ ok: true })
    expect(await reserveInvitations(member, 4)).toEqual({ ok: true })
  })

  it('refuses a whole list that would cross the budget, and gives its share back', async () => {
    await reserveInvitations(member, 8)
    expect(await reserveInvitations(member, 5)).toEqual({ ok: false, remaining: 2 })
    expect(await reserveInvitations(member, 2)).toEqual({ ok: true })
  })

  it('does not limit platform administrators', async () => {
    expect(await reserveInvitations({ id: 'a1', isStaff: true }, 500)).toEqual({ ok: true })
  })
})
