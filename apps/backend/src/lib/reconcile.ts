import { EGRESS_ABORTED, EGRESS_COMPLETE, EGRESS_FAILED, endedStatus, type FinalRecordingStatus } from './egressStatus'

/**
 * Pure decisions of the LiveKit reconciliation (services/livekitReconcile.ts),
 * kept apart so they can be tested without LiveKit or a database.
 */

/** A recording still « in progress » here: what LiveKit says it really is. */
export function recordingVerdict(
  rec: { status: string; workerId: string | null; updatedAt: Date },
  egress: { status?: number | string } | null,
  now: Date
): FinalRecordingStatus | 'FAILED_TO_START' | null {
  if (!rec.workerId) {
    // Never got an egress id: the start failed between the two writes.
    return now.getTime() - rec.updatedAt.getTime() > 10 * 60_000 ? 'FAILED_TO_START' : null
  }
  if (!egress) return 'ABORTED' // LiveKit no longer knows it
  const s = egress.status
  if (s != null && (EGRESS_COMPLETE.has(s) || EGRESS_FAILED.has(s) || EGRESS_ABORTED.has(s))) return endedStatus(s)
  return null // still running on LiveKit's side
}

/** An open session whose LiveKit room is gone: when it actually ended. */
export function sessionEnd(startedAt: Date, lastLeftAts: (Date | null)[], now: Date): { endedAt: Date; durationSec: number } {
  const lefts = lastLeftAts.filter((d): d is Date => !!d).map((d) => d.getTime())
  const endedAt = new Date(lefts.length ? Math.max(...lefts, startedAt.getTime()) : now.getTime())
  return { endedAt, durationSec: Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) }
}
