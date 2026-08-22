import { useEffect, useState } from 'react'
import { useMaybeRoomContext } from '@livekit/components-react'
import { RoomEvent } from 'livekit-client'
import { useRoomData } from './useRoomData'
import { getParticipantIsRoomAdmin } from '@/features/rooms/utils/getParticipantIsRoomAdmin'

/**
 * Whether the local user may moderate this room.
 *
 * Two standings, and both are needed. `is_administrable` comes from the room
 * fetch and covers the owner, but it is a cached HTTP response — nothing
 * refreshes it mid-call. A co-host promoted during the session is flagged on
 * their LiveKit participant instead, which does arrive live, so we listen for
 * the attribute change rather than re-fetching.
 */
export const useIsAdminOrOwner = () => {
  const apiRoomData = useRoomData()
  const room = useMaybeRoomContext()
  const [isSessionAdmin, setIsSessionAdmin] = useState(
    () => !!room && getParticipantIsRoomAdmin(room.localParticipant)
  )

  useEffect(() => {
    if (!room) {
      setIsSessionAdmin(false)
      return
    }
    const sync = () =>
      setIsSessionAdmin(getParticipantIsRoomAdmin(room.localParticipant))
    sync() // the attribute is already set when joining as owner
    room.on(RoomEvent.ParticipantAttributesChanged, sync)
    room.on(RoomEvent.Connected, sync)
    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, sync)
      room.off(RoomEvent.Connected, sync)
    }
  }, [room])

  return !!apiRoomData?.is_administrable || isSessionAdmin
}
