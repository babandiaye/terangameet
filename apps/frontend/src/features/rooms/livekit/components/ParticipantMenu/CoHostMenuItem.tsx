import type { Participant } from 'livekit-client'
import { menuRecipe } from '@/primitives/menuRecipe'
import { HStack } from '@/styled-system/jsx'
import { RiUserStarLine, RiUserUnfollowLine } from '@remixicon/react'
import { MenuItem } from 'react-aria-components'
import { usePromoteParticipant } from '@/features/rooms/api/promoteParticipant'
import { getParticipantIsRoomAdmin } from '@/features/rooms/utils/getParticipantIsRoomAdmin'
import { useTranslation } from 'react-i18next'

export const CoHostMenuItem = ({
  participant,
}: {
  participant: Participant
}) => {
  const { t } = useTranslation('rooms', { keyPrefix: 'participantMenu' })
  const { promoteParticipant } = usePromoteParticipant()
  const isCoHost = getParticipantIsRoomAdmin(participant)
  const key = isCoHost ? 'revokeCoHost' : 'grantCoHost'
  const Icon = isCoHost ? RiUserUnfollowLine : RiUserStarLine

  return (
    <MenuItem
      aria-label={t(`${key}.ariaLabel`, { name: participant.name })}
      className={menuRecipe({ icon: true }).item}
      onAction={() =>
        promoteParticipant(participant, !isCoHost).catch((e) =>
          console.error('Failed to update co-host:', e)
        )
      }
    >
      <HStack gap={0.25}>
        <Icon size={20} aria-hidden />
        {t(`${key}.label`)}
      </HStack>
    </MenuItem>
  )
}
