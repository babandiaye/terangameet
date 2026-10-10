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
    const where = readableRecordingsWhere(user, { hostedRoomIds: ['r1', 'r2'], listedSince: [] })
    expect(where.OR).toContainEqual({ roomId: { in: ['r1', 'r2'] } })
  })

  it('opens recordings made after a listed participant was added, not before', () => {
    const where = readableRecordingsWhere(user, { hostedRoomIds: [], listedSince: [{ roomId: 'r3', since }] })
    expect(where.OR).toContainEqual({ roomId: 'r3', createdAt: { gte: since } })
  })

  it('applies the same standing when opening a recording by id', () => {
    const standing = { hostedRoomIds: ['r1'], listedSince: [] }
    expect(recordingVisibleTo(user, standing)).toEqual(readableRecordingsWhere(user, standing))
  })
})
