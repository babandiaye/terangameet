import { useTelephony } from './useTelephony'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { formatPinCode } from '@/features/rooms/utils/telephony'
import type { ApiRoom } from '@/features/rooms/api/ApiRoom'
import { getRouteUrl } from '@/navigation/getRouteUrl'
import { meetingTitle } from '@/features/rooms/utils/meetingTitle'

const COPY_SUCCESS_TIMEOUT = 3000

export const useCopyRoomToClipboard = (room: ApiRoom | undefined) => {
  const telephony = useTelephony()
  const { t } = useTranslation('global', { keyPrefix: 'clipboardContent' })

  const [isCopied, setIsCopied] = useState(false)
  const [isRoomUrlCopied, setIsRoomUrlCopied] = useState(false)

  useEffect(() => {
    if (isCopied) {
      const timeout = setTimeout(() => setIsCopied(false), COPY_SUCCESS_TIMEOUT)
      return () => clearTimeout(timeout)
    }
  }, [isCopied])

  useEffect(() => {
    if (isRoomUrlCopied) {
      const timeout = setTimeout(
        () => setIsRoomUrlCopied(false),
        COPY_SUCCESS_TIMEOUT
      )
      return () => clearTimeout(timeout)
    }
  }, [isRoomUrlCopied])

  const roomSlug = room?.slug
  const roomUrl = useMemo(() => {
    return roomSlug ? getRouteUrl('room', roomSlug) : ''
  }, [roomSlug])

  const hasTelephonyInfo = useMemo(() => {
    return telephony.enabled && room?.pin_code
  }, [telephony.enabled, room])

  const content = useMemo(() => {
    if (!roomUrl || !room) return ''
    // Like Google Meet, a titled meeting is introduced by its title, so the
    // pasted invitation says what it is for and not only where it is.
    const title = meetingTitle(room)
    if (!hasTelephonyInfo) {
      return title ? [title, t('url', { roomUrl })].join('\n') : roomUrl
    }

    return [
      ...(title ? [title] : []),
      t('url', { roomUrl }),
      t('numberAndPin', {
        phoneNumber: telephony?.internationalPhoneNumber,
        pinCode: formatPinCode(room.pin_code),
      }),
    ].join('\n')
  }, [roomUrl, hasTelephonyInfo, telephony, room, t])

  const copyRoomToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setIsCopied(true)
    } catch (error) {
      console.error(error)
    }
  }

  const copyRoomUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl)
      setIsRoomUrlCopied(true)
    } catch (error) {
      console.error(error)
    }
  }

  return {
    isCopied,
    copyRoomToClipboard,
    isRoomUrlCopied,
    copyRoomUrlToClipboard,
  }
}
