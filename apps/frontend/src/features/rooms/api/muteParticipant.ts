import { type Participant, Track } from 'livekit-client'
import { showActionError } from '@/features/notifications/utils'
import Source = Track.Source
import { useRoomData } from '../livekit/hooks/useRoomData'
import {
  useNotifyParticipants,
  NotificationType,
} from '@/features/notifications'
import { fetchApi } from '@/api/fetchApi'
import { useIsAdminOrOwner } from '../livekit/hooks/useIsAdminOrOwner'

import { useCallback } from 'react'

export const useMuteParticipant = () => {
  const apiRoomData = useRoomData()
  const { notifyParticipants } = useNotifyParticipants()
  const isAdminOrOwner = useIsAdminOrOwner()

  const muteParticipant = useCallback(
    async (participant: Participant) => {
      if (!apiRoomData?.livekit?.room) {
        throw new Error('Room id is not available')
      }

      const trackSid = participant.getTrackPublication(
        Source.Microphone
      )?.trackSid

      if (!trackSid) {
        return
      }

      // Always sent, not only for non-admins: a co-host promoted for this
      // session has no other proof of standing, and the server needs the token
      // to know which participant is calling.
      const headers = apiRoomData.livekit.token
        ? { Authorization: `Bearer ${apiRoomData.livekit.token}` }
        : undefined
      if (!isAdminOrOwner && !headers) {
        showActionError(
          null,
          'Impossible de couper ce micro : rechargez la page.'
        )
        return
      }

      let response
      try {
        response = await fetchApi(
          `rooms/${apiRoomData.livekit.room}/mute-participant/`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              participant_identity: participant.identity,
              track_sid: trackSid,
            }),
          }
        )
      } catch (error) {
        showActionError(
          error,
          `Le micro de ${participant.name || 'ce participant'} n’a pas pu être coupé.`
        )
        return
      }

      try {
        await notifyParticipants({
          type: NotificationType.ParticipantMuted,
          destinationIdentities: [participant.identity],
        })
      } catch (e) {
        console.error(
          `Failed to notify muted participant ${participant.identity}: ${e}`
        )
      }

      return response
    },
    [apiRoomData, isAdminOrOwner, notifyParticipants]
  )

  return { muteParticipant }
}
