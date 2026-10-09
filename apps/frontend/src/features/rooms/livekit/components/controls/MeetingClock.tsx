import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { css } from '@/styled-system/css'
import { useMeetingTitle } from '../../hooks/useMeetingTitle'

/** Milliseconds until the next minute starts, so the clock flips on time. */
const untilNextMinute = () => 60_000 - (Date.now() % 60_000)

const useCurrentMinute = () => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(new Date())
      timer = setTimeout(tick, untilNextMinute())
    }
    timer = setTimeout(tick, untilNextMinute())
    return () => clearTimeout(timer)
  }, [])
  return now
}

/**
 * Bottom-left of the control bar, as in Google Meet: "10:32 | Meeting title".
 * An untitled meeting shows its link code instead.
 */
export const MeetingClock = () => {
  const { i18n } = useTranslation()
  const { room, title } = useMeetingTitle()
  const now = useCurrentMinute()

  const label = title ?? room?.slug
  const time = now.toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        minWidth: 0,
        color: 'white',
        fontSize: '1rem',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      })}
    >
      <time dateTime={now.toISOString()}>{time}</time>
      {!!label && (
        <>
          <span
            aria-hidden="true"
            className={css({
              width: '1px',
              height: '1rem',
              bg: 'rgba(255, 255, 255, 0.4)',
            })}
          />
          <span
            title={label}
            className={css({ overflow: 'hidden', textOverflow: 'ellipsis' })}
          >
            {label}
          </span>
        </>
      )}
    </div>
  )
}
