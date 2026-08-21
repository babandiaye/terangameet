import { describe, it, expect } from 'vitest'
import { endedStatus } from './egressStatus'

describe('endedStatus', () => {
  it('maps EGRESS_COMPLETE → SAVED (numeric and string forms)', () => {
    expect(endedStatus(3)).toBe('SAVED')
    expect(endedStatus('EGRESS_COMPLETE')).toBe('SAVED')
  })

  it('maps EGRESS_FAILED → FAILED_TO_STOP', () => {
    expect(endedStatus(4)).toBe('FAILED_TO_STOP')
    expect(endedStatus('EGRESS_FAILED')).toBe('FAILED_TO_STOP')
  })

  it('maps EGRESS_ABORTED and LIMIT_REACHED → ABORTED', () => {
    expect(endedStatus(5)).toBe('ABORTED')
    expect(endedStatus('EGRESS_ABORTED')).toBe('ABORTED')
    expect(endedStatus(6)).toBe('ABORTED')
    expect(endedStatus('EGRESS_LIMIT_REACHED')).toBe('ABORTED')
  })

  it('falls back to STOPPED for unknown or missing status', () => {
    expect(endedStatus(undefined)).toBe('STOPPED')
    expect(endedStatus(99)).toBe('STOPPED')
    expect(endedStatus('SOMETHING_ELSE')).toBe('STOPPED')
  })
})
