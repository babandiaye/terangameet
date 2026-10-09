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
