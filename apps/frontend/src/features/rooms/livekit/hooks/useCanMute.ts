import { useIsAdminOrOwner } from './useIsAdminOrOwner'
import type { Participant } from 'livekit-client'

/**
 * Who may mute this participant: themselves, or a moderator (owner,
 * co-organizer, co-host of the session). The server enforces the same rule
 * (POST /rooms/:id/mute-participant/), so the button is never offered to
 * someone who would be refused.
 */
export const useCanMute = (participant: Participant) => {
  const isAdminOrOwner = useIsAdminOrOwner()
  return participant.isLocal || isAdminOrOwner
}
