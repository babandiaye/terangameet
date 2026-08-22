import { useRoomData } from '../livekit/hooks/useRoomData'
import { fetchApi } from '@/api/fetchApi'
import { useLivekitAuthHeaders } from './useLivekitAuthHeaders'

/**
 * End the meeting for everyone. LiveKit disconnects all participants and emits
 * room_finished, which closes the session server-side.
 */
export const useEndMeeting = () => {
  const data = useRoomData()
  const headers = useLivekitAuthHeaders()

  const endMeeting = async () => {
    if (!data?.id) {
      throw new Error('Room id is not available')
    }
    return fetchApi(`rooms/${data.id}/end/`, { method: 'POST', headers })
  }
  return { endMeeting }
}
