import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: { op: string; args: unknown }[] = []
let listed: { id: string; email: string; createdAt: Date; addedByMeetingId: string | null }[] = []
let elsewhere: { email: string; meetingId: string }[] = []

const tx = {
  roomInvitee: {
    findMany: async (args: unknown) => (calls.push({ op: 'invitee.findMany', args }), listed),
    update: async (args: unknown) => calls.push({ op: 'invitee.update', args }),
    deleteMany: async (args: unknown) => calls.push({ op: 'invitee.deleteMany', args }),
  },
  roomInviteePeriod: { createMany: async (args: unknown) => calls.push({ op: 'period.createMany', args }) },
  meetingAttendee: { findMany: async () => elsewhere },
}
vi.mock('../lib/prisma', () => ({ prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } }))

const { releaseMeetingGuests } = await import('./roomInvitees')
const since = new Date('2026-10-01T08:00:00Z')

describe('releaseMeetingGuests', () => {
  beforeEach(() => {
    calls.length = 0
    listed = []
    elsewhere = []
  })

  it('only considers people this meeting put on the list, never co-organizers', async () => {
    await releaseMeetingGuests('room', 'm1', ['a@x.sn'])
    expect(calls[0]).toEqual({
      op: 'invitee.findMany',
      args: { where: { roomId: 'room', email: { in: ['a@x.sn'] }, addedByMeetingId: 'm1', isCoOrganizer: false } },
    })
  })

  it('ends the stay of a guest no other meeting expects, keeping its period', async () => {
    listed = [{ id: 'i1', email: 'a@x.sn', createdAt: since, addedByMeetingId: 'm1' }]
    expect(await releaseMeetingGuests('room', 'm1', ['a@x.sn'])).toBe(1)
    expect(calls).toContainEqual({
      op: 'period.createMany',
      args: { data: [{ roomId: 'room', email: 'a@x.sn', since, wholeHistory: false }] },
    })
    expect(calls).toContainEqual({ op: 'invitee.deleteMany', args: { where: { id: { in: ['i1'] } } } })
  })

  it('keeps a guest expected at another upcoming meeting, now attached to it', async () => {
    listed = [{ id: 'i1', email: 'a@x.sn', createdAt: since, addedByMeetingId: 'm1' }]
    elsewhere = [{ email: 'a@x.sn', meetingId: 'm2' }]
    expect(await releaseMeetingGuests('room', 'm1', ['a@x.sn'])).toBe(0)
    expect(calls).toContainEqual({ op: 'invitee.update', args: { where: { id: 'i1' }, data: { addedByMeetingId: 'm2' } } })
    expect(calls.some((c) => c.op === 'invitee.deleteMany')).toBe(false)
  })
})
