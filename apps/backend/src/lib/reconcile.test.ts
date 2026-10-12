import { describe, expect, it } from 'vitest'
import { recordingVerdict, sessionEnd } from './reconcile'

const now = new Date('2026-10-12T12:00:00Z')
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000)

describe('recordingVerdict', () => {
  it('finalizes a recording whose egress ended on LiveKit', () => {
    expect(recordingVerdict({ status: 'ACTIVE', workerId: 'EG_1', updatedAt: minutesAgo(30) }, { status: 3 }, now)).toBe('SAVED')
    expect(recordingVerdict({ status: 'STOPPING', workerId: 'EG_1', updatedAt: minutesAgo(30) }, { status: 4 }, now)).toBe('FAILED_TO_STOP')
  })

  it('aborts a recording LiveKit no longer knows', () => {
    expect(recordingVerdict({ status: 'ACTIVE', workerId: 'EG_1', updatedAt: minutesAgo(30) }, null, now)).toBe('ABORTED')
  })

  it('leaves a running egress alone', () => {
    expect(recordingVerdict({ status: 'ACTIVE', workerId: 'EG_1', updatedAt: minutesAgo(30) }, { status: 1 }, now)).toBeNull()
  })

  it('fails a start that never got an egress id, after a grace period', () => {
    expect(recordingVerdict({ status: 'INITIATED', workerId: null, updatedAt: minutesAgo(2) }, null, now)).toBeNull()
    expect(recordingVerdict({ status: 'INITIATED', workerId: null, updatedAt: minutesAgo(15) }, null, now)).toBe('FAILED_TO_START')
  })
})

describe('sessionEnd', () => {
  it('ends at the last departure when known', () => {
    const r = sessionEnd(minutesAgo(60), [minutesAgo(50), minutesAgo(20), null], now)
    expect(r.endedAt).toEqual(minutesAgo(20))
    expect(r.durationSec).toBe(40 * 60)
  })

  it('ends now when nobody left on record', () => {
    expect(sessionEnd(minutesAgo(10), [null], now).endedAt).toEqual(now)
  })
})
