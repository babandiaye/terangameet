import { toastQueue } from './components/ToastProvider'
import { NotificationType } from './NotificationType'
import { NotificationDuration } from './NotificationDuration'
import type { Participant } from 'livekit-client'
import type { NotificationPayload } from './NotificationPayload'
import type { RecordingMode } from '@/features/recording'
import { ApiError } from '@/api/ApiError'

export const showLowerHandToast = (
  participant: Participant,
  onClose: () => void
) => {
  toastQueue.add(
    {
      participant,
      type: NotificationType.LowerHand,
    },
    {
      timeout: NotificationDuration.LOWER_HAND,
      onClose,
    }
  )
}

export const closeLowerHandToasts = () => {
  toastQueue.visibleToasts.forEach((toast) => {
    if (toast.content.type === NotificationType.LowerHand) {
      toastQueue.close(toast.key)
    }
  })
}

export const decodeNotificationDataReceived = (
  payload: Uint8Array
): NotificationPayload | undefined => {
  if (!payload || !(payload instanceof Uint8Array)) {
    throw new Error('Invalid payload: expected Uint8Array')
  }
  try {
    const decoder = new TextDecoder()
    const jsonString = decoder.decode(payload)
    if (!jsonString || typeof jsonString !== 'string') {
      throw new Error('Invalid decoded content')
    }
    // Parse with additional validation if needed
    const parsed = JSON.parse(jsonString)
    return parsed as NotificationPayload
  } catch (error) {
    // Handle errors appropriately for your application
    console.error('Failed to decode notification payload:', error)
    return
  }
}

export const notifyRecordingSaveInProgress = (
  mode: RecordingMode,
  participant: Participant
) => {
  toastQueue.add(
    {
      participant,
      mode,
      type: NotificationType.RecordingSaving,
    },
    { timeout: NotificationDuration.RECORDING_SAVING }
  )
}

/**
 * Tell the moderator an action failed (mute, co-host, end meeting…), with the
 * server's reason when it gave one. Before, these failures only reached the
 * browser console: the moderator saw nothing happen and could not know why.
 */
export const showActionError = (error: unknown, fallback: string) => {
  // The server's reason helps when it is a refusal (4xx: rights, state); a
  // technical failure (5xx) only repeats what the fallback already says.
  const detail =
    error instanceof ApiError && error.statusCode < 500
      ? (error.body as { detail?: unknown } | undefined)?.detail
      : undefined
  toastQueue.add(
    {
      type: NotificationType.ActionFailed,
      message:
        typeof detail === 'string' && detail
          ? `${fallback} ${detail}`
          : fallback,
    },
    { timeout: NotificationDuration.MESSAGE }
  )
}
