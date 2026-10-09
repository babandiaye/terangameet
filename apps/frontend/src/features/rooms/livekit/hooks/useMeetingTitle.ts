import { useEffect } from 'react'
import { useParams } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { useMaybeRoomContext } from '@livekit/components-react'
import { RoomEvent } from 'livekit-client'
import { keys } from '@/api/queryKeys'
import { queryClient } from '@/api/queryClient'
import { fetchRoom } from '@/features/rooms/api/fetchRoom'
import type { ApiRoom } from '@/features/rooms/api/ApiRoom'
import { meetingTitle } from '@/features/rooms/utils/meetingTitle'
import { decodeNotificationDataReceived } from '@/features/notifications/utils'
import { NotificationType } from '@/features/notifications/NotificationType'

/**
 * The meeting's title, kept current during the call.
 *
 * Subscribes to the cached room (useRoomData only reads it once), and applies
 * the server's RoomRenamed broadcast so a rename by the owner reaches every
 * participant without a reload.
 */
export const useMeetingTitle = () => {
  const { roomId } = useParams()
  const room = useMaybeRoomContext()

  const { data } = useQuery({
    queryKey: [keys.room, roomId],
    queryFn: () => fetchRoom({ roomId: roomId as string }),
    retry: false,
    enabled: false,
  })

  useEffect(() => {
    if (!room) return
    const onData = (payload: Uint8Array) => {
      const notification = decodeNotificationDataReceived(payload)
      const name = notification?.data?.name
      if (notification?.type !== NotificationType.RoomRenamed || !name) return
      queryClient.setQueryData<ApiRoom>([keys.room, roomId], (old) =>
        old ? { ...old, name } : old
      )
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
    }
  }, [room, roomId])

  return { room: data, title: meetingTitle(data) }
}
