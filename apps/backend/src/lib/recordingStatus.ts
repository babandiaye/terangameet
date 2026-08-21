/**
 * Pure mapping of Prisma RecordingStatus → the exact string the frontend
 * RecordingStatus enum expects (camelCase for the FAILED_* states). Kept
 * side-effect free for unit testing. A mismatch here previously made the
 * download page show "non enregistré" for valid recordings.
 */
export const STATUS_TO_API: Record<string, string> = {
  INITIATED: 'initiated',
  ACTIVE: 'active',
  STOPPED: 'stopped',
  SAVED: 'saved',
  ABORTED: 'aborted',
  FAILED_TO_START: 'failedToStart',
  FAILED_TO_STOP: 'failedToStop',
  NOTIFICATION_SUCCEEDED: 'notification_succeeded',
}

export function recordingStatusToApi(status: string): string {
  return STATUS_TO_API[status] ?? status.toLowerCase()
}
