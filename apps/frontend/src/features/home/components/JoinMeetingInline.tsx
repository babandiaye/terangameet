import { FormEvent, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RiArrowRightLine } from '@remixicon/react'
import { css } from '@/styled-system/css'
import { navigateTo } from '@/navigation/navigateTo'
import {
  isRoomValid,
  normalizeRoomId,
} from '@/features/rooms/utils/isRoomValid'

/**
 * The landing page's signature element: joining a meeting is the one thing an
 * anonymous visitor can actually complete, so the field is the hero rather than
 * a button that opens a dialog over it. Form-as-CTA — the action IS the product.
 *
 * Accepts a bare code (abc-defg-hij), an unhyphenated one, or a full URL pasted
 * from an invitation, normalising all three before navigating.
 */
export const JoinMeetingInline = () => {
  const { t } = useTranslation('home')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = useId()

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const raw = value.trim().replace(`${window.location.origin}/`, '')
    if (!raw) {
      setError(t('landing.join.empty'))
      return
    }
    const roomId = normalizeRoomId(raw)
    if (!isRoomValid(roomId)) {
      setError(t('landing.join.invalid'))
      return
    }
    setError(null)
    navigateTo('room', roomId)
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={css({ marginTop: '2rem' })}
    >
      <label
        htmlFor={inputId}
        className={css({
          display: 'block',
          fontSize: '0.88rem',
          fontWeight: 600,
          color: 'greyscale.800',
          marginBottom: '0.55rem',
        })}
      >
        {t('landing.join.label')}
      </label>

      <div
        className={css({
          display: 'flex',
          flexDirection: { base: 'column', xsm: 'row' },
          gap: '0.6rem',
          maxWidth: '30rem',
        })}
      >
        <input
          id={inputId}
          name="roomId"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('landing.join.placeholder')}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError(null)
          }}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={css({
            flex: 1,
            minWidth: 0,
            height: '48px',
            paddingX: '0.9rem',
            fontSize: '1rem',
            color: 'greyscale.1000',
            backgroundColor: 'white',
            border: '2px solid',
            borderColor: 'greyscale.300',
            borderRadius: '10px',
            outline: 'none',
            transition: 'border-color 180ms ease',
            _placeholder: { color: 'greyscale.500' },
            _hover: { borderColor: 'greyscale.500' },
            _focusVisible: { borderColor: 'primary.800' },
            '&[aria-invalid="true"]': { borderColor: 'danger.600' },
          })}
        />
        <button
          type="submit"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            height: '48px',
            paddingX: '1.4rem',
            flexShrink: 0,
            fontSize: '0.95rem',
            fontWeight: 600,
            color: 'white',
            backgroundColor: 'primary.800',
            border: '2px solid',
            borderColor: 'primary.800',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'background-color 180ms ease',
            _hover: { backgroundColor: 'primary.action' },
            _focusVisible: {
              outline: '2px solid',
              outlineColor: 'primary.800',
              outlineOffset: '2px',
            },
          })}
        >
          {t('joinMeeting')}
          <RiArrowRightLine size={18} aria-hidden="true" />
        </button>
      </div>

      <p
        id={errorId}
        role="alert"
        className={css({
          marginTop: '0.5rem',
          minHeight: '1.25rem',
          fontSize: '0.85rem',
          color: 'danger.600',
        })}
      >
        {error}
      </p>
    </form>
  )
}
