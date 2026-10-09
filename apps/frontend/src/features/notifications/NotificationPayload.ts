import type { NotificationType } from './NotificationType'

export interface NotificationPayload {
  type: NotificationType
  data?: {
    emoji?: string
    removedSources?: string[]
    /** New meeting title, with RoomRenamed. */
    name?: string
  }
}
