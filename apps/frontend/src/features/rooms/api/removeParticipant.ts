import type { Participant } from 'livekit-client'
import { useRoomData } from '../livekit/hooks/useRoomData'
import { fetchApi } from '@/api/fetchApi'
import { useLivekitAuthHeaders } from './useLivekitAuthHeaders'

export const useRemoveParticipant = () => {
  const data = useRoomData()
  const headers = useLivekitAuthHeaders()

  const removeParticipant = async (participant: Participant) => {
    if (!data?.id) {
      throw new Error('Room id is not available')
    }

    return fetchApi(`rooms/${data.id}/remove-participant/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        participant_identity: participant.identity,
      }),
    })
  }
  return { removeParticipant }
}
