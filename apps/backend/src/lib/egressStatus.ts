/**
 * Pure mapping of LiveKit EgressStatus → our final RecordingStatus.
 * Kept side-effect free so it can be unit-tested without any infrastructure.
 * Status arrives as either the numeric enum or its proto-JSON string name.
 */
export const EGRESS_COMPLETE = new Set<number | string>([3, 'EGRESS_COMPLETE'])
export const EGRESS_FAILED = new Set<number | string>([4, 'EGRESS_FAILED'])
export const EGRESS_ABORTED = new Set<number | string>([5, 'EGRESS_ABORTED', 6, 'EGRESS_LIMIT_REACHED'])

export type FinalRecordingStatus = 'SAVED' | 'FAILED_TO_STOP' | 'ABORTED' | 'STOPPED'

export function endedStatus(status: number | string | undefined): FinalRecordingStatus {
  if (status != null && EGRESS_COMPLETE.has(status)) return 'SAVED'
  if (status != null && EGRESS_FAILED.has(status)) return 'FAILED_TO_STOP'
  if (status != null && EGRESS_ABORTED.has(status)) return 'ABORTED'
  // Unknown/absent status: the egress ended but we can't confirm success.
  return 'STOPPED'
}
