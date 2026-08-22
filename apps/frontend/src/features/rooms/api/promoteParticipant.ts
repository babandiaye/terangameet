import type { Participant } from 'livekit-client'
import { useRoomData } from '../livekit/hooks/useRoomData'
import { fetchApi } from '@/api/fetchApi'

/**
 * Grant or revoke co-host for the current session only. Nothing is persisted:
 * the standing lives on the LiveKit participant and ends with the room.
 */
export const usePromoteParticipant = () => {
  const data = useRoomData()

  const promoteParticipant = async (
    participant: Participant,
    coHost: boolean
  ) => {
    if (!data?.id) {
      throw new Error('Room id is not available')
    }

    return fetchApi(`rooms/${data.id}/promote-participant/`, {
      method: 'POST',
      body: JSON.stringify({
        participant_identity: participant.identity,
        co_host: coHost,
      }),
    })
  }
  return { promoteParticipant }
}
