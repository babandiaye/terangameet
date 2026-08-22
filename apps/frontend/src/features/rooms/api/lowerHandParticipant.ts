import type { Participant } from 'livekit-client'
import { fetchApi } from '@/api/fetchApi.ts'
import { useRoomData } from '@/features/rooms/livekit/hooks/useRoomData'
import { useLivekitAuthHeaders } from '@/features/rooms/api/useLivekitAuthHeaders'

export const useLowerHandParticipant = () => {
  const data = useRoomData()
  const headers = useLivekitAuthHeaders()

  const lowerHandParticipant = async (participant: Participant) => {
    if (!data?.id) {
      throw new Error('Room id is not available')
    }

    const newAttributes = {
      ...participant.attributes,
      handRaisedAt: '',
    }

    return await fetchApi(`rooms/${data.id}/update-participant/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        participant_identity: participant.identity,
        attributes: newAttributes,
      }),
    })
  }
  return { lowerHandParticipant }
}
