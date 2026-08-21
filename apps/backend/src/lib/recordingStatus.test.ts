import { describe, it, expect } from 'vitest'
import { recordingStatusToApi } from './recordingStatus'

describe('recordingStatusToApi', () => {
  it('lowercases the simple statuses', () => {
    expect(recordingStatusToApi('INITIATED')).toBe('initiated')
    expect(recordingStatusToApi('ACTIVE')).toBe('active')
    expect(recordingStatusToApi('STOPPED')).toBe('stopped')
    expect(recordingStatusToApi('SAVED')).toBe('saved')
    expect(recordingStatusToApi('ABORTED')).toBe('aborted')
  })

  it('uses camelCase for the FAILED_* states (frontend enum contract)', () => {
    expect(recordingStatusToApi('FAILED_TO_START')).toBe('failedToStart')
    expect(recordingStatusToApi('FAILED_TO_STOP')).toBe('failedToStop')
  })

  it('keeps the notification status snake_cased', () => {
    expect(recordingStatusToApi('NOTIFICATION_SUCCEEDED')).toBe('notification_succeeded')
  })

  it('degrades gracefully for unknown values', () => {
    expect(recordingStatusToApi('WEIRD')).toBe('weird')
  })
})
