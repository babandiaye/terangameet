import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConnectionState, useRoomContext } from '@livekit/components-react'
import { ConnectionState } from 'livekit-client'
import { RiShutDownLine } from '@remixicon/react'
import { Button, Dialog, P } from '@/primitives'
import { HStack } from '@/styled-system/jsx'
import { useEndMeeting } from '@/features/rooms/api/endMeeting'
import { useIsAdminOrOwner } from '../../hooks/useIsAdminOrOwner'

/**
 * Ends the call for every participant, not just the person clicking. Reserved to
 * moderators and always confirmed: unlike leaving, this cannot be undone by
 * rejoining — the room is gone and the session is closed.
 */
export const EndMeetingButton = ({
  variant = 'danger',
  description = false,
  onPress,
}: {
  /** `primaryTextDark` + description for the mobile overflow menu. */
  variant?: 'danger' | 'primaryTextDark'
  description?: boolean
  /** Called as soon as the button is pressed, to close a containing menu. */
  onPress?: () => void
} = {}) => {
  const { t } = useTranslation('rooms', { keyPrefix: 'controls.endMeeting' })
  const isAdminOrOwner = useIsAdminOrOwner()
  const room = useRoomContext()
  const connectionState = useConnectionState(room)
  const { endMeeting } = useEndMeeting()
  const [isConfirming, setIsConfirming] = useState(false)

  if (!isAdminOrOwner) return null

  return (
    <>
      <Button
        isDisabled={connectionState === ConnectionState.Disconnected}
        variant={variant}
        tooltip={t('tooltip')}
        aria-label={t('tooltip')}
        description={description}
        onPress={() => {
          onPress?.()
          setIsConfirming(true)
        }}
        data-attr="controls-end-meeting"
      >
        <RiShutDownLine />
      </Button>
      <Dialog
        isOpen={isConfirming}
        role="alertdialog"
        aria-label={t('heading')}
      >
        <P>{t('description')}</P>
        <HStack gap={1}>
          <Button
            variant="text"
            size="sm"
            onPress={() => setIsConfirming(false)}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="text"
            size="sm"
            onPress={() => {
              setIsConfirming(false)
              endMeeting().catch((e) =>
                console.error('Failed to end the meeting:', e)
              )
            }}
          >
            {t('confirm')}
          </Button>
        </HStack>
      </Dialog>
    </>
  )
}
