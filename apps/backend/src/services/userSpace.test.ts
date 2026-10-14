import { describe, expect, it } from 'vitest'
import { recordingVisibleTo, readableRecordingsWhere } from './userSpace'

const user = { id: 'u1', sub: 'sub-1', isStaff: false }

describe('recordingVisibleTo', () => {
  it('limits a member to recordings they started or attended', () => {
    expect(recordingVisibleTo(user)).toEqual(readableRecordingsWhere(user))
  })

  it('lets a platform administrator open any recording', () => {
    expect(recordingVisibleTo({ ...user, isStaff: true })).toEqual({})
  })
})

describe('readableRecordingsWhere', () => {
  const since = new Date('2026-10-01T08:00:00Z')

  it('keeps attendance and own recordings when the user has no standing on any room', () => {
    expect(readableRecordingsWhere(user).OR).toHaveLength(2)
  })

  it('opens every recording of a room the user owns or co-organizes', () => {
    const where = readableRecordingsWhere(user, { hostedRoomIds: ['r1', 'r2'], listedSince: [], listedPeriods: [] })
    expect(where.OR).toContainEqual({ roomId: { in: ['r1', 'r2'] } })
  })

  it('opens recordings made after a meeting guest was added, not before', () => {
    const where = readableRecordingsWhere(user, { hostedRoomIds: [], listedSince: [{ roomId: 'r3', since }], listedPeriods: [] })
    expect(where.OR).toContainEqual({ roomId: 'r3', createdAt: { gte: since } })
  })

  it('keeps everything recorded before the removal of a direct member', () => {
    const until = new Date('2026-10-05T08:00:00Z')
    const where = readableRecordingsWhere(user, {
      hostedRoomIds: [],
      listedSince: [],
      listedPeriods: [{ roomId: 'r5', since: null, until }],
    })
    expect(where.OR).toContainEqual({ roomId: 'r5', createdAt: { lt: until } })
  })

  it('keeps the recordings made while a removed meeting guest was listed', () => {
    const until = new Date('2026-10-05T08:00:00Z')
    const where = readableRecordingsWhere(user, {
      hostedRoomIds: [],
      listedSince: [],
      listedPeriods: [{ roomId: 'r4', since, until }],
    })
    expect(where.OR).toContainEqual({ roomId: 'r4', createdAt: { gte: since, lt: until } })
  })

  it('applies the same standing when opening a recording by id', () => {
    const standing = { hostedRoomIds: ['r1'], listedSince: [], listedPeriods: [] }
    expect(recordingVisibleTo(user, standing)).toEqual(readableRecordingsWhere(user, standing))
  })
})
