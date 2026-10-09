/** Statuses as the API returns them (recordingStatusToApi on the server). */
export const isRecordingReady = (status: string) =>
  status === 'saved' || status === 'notification_succeeded'

/** A recording's status in words, with the tone of its badge — same in the admin and in Mon espace. */
export const recordingStatusLabel = (
  status: string
): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } => {
  if (isRecordingReady(status)) return { label: 'Disponible', tone: 'success' }
  if (status === 'active' || status === 'initiated')
    return { label: 'En cours', tone: 'warning' }
  if (status === 'stopped') return { label: 'Finalisation…', tone: 'warning' }
  if (status.startsWith('failed') || status === 'aborted')
    return { label: 'Échec', tone: 'danger' }
  return { label: status, tone: 'neutral' }
}
