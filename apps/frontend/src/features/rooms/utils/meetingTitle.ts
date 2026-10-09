import type { ApiRoom } from '@/features/rooms/api/ApiRoom'

/** Longest title the server accepts (mirrors ROOM_NAME_MAX in the backend). */
export const MEETING_TITLE_MAX = 120

/**
 * The title a person gave the meeting, or null when it has none. Untitled
 * meetings carry their link code as name, which is not worth repeating next to
 * the link itself.
 */
export const meetingTitle = (
  room?: Pick<ApiRoom, 'name' | 'slug'> | null
): string | null => {
  const name = room?.name?.trim()
  if (!name || name === room?.slug) return null
  return name
}
