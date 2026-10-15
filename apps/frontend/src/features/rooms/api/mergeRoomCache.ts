import { queryClient } from '@/api/queryClient'
import { keys } from '@/api/queryKeys'
import type { ApiRoom } from './ApiRoom'

/**
 * Store a room returned by PATCH in the cache of the call.
 *
 * Merge, never replace: the PATCH answer carries no `livekit` block (room id
 * and token), which only the join hands out. Replacing the cached room with it
 * left every moderation action — mute, mute all, remove, end, record — with no
 * room to act on until the page was reloaded.
 */
export const mergeRoomIntoCache = (roomKey: string, room: ApiRoom) => {
  queryClient.setQueryData<ApiRoom>([keys.room, roomKey], (old) =>
    old ? { ...old, ...room, livekit: room.livekit ?? old.livekit } : room
  )
}
