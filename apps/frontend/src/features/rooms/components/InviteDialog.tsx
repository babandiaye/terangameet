import { useTranslation } from 'react-i18next'
import { getRouteUrl } from '@/navigation/getRouteUrl'
import { Div, Button, type DialogProps, P, Bold } from '@/primitives'
import { HStack, styled, VStack } from '@/styled-system/jsx'
import { Heading, Dialog } from 'react-aria-components'
import { Text, text } from '@/primitives/Text'
import {
  RiCheckLine,
  RiCloseLine,
  RiFileCopyLine,
  RiMailSendLine,
  RiSpam2Fill,
} from '@remixicon/react'
import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { useConfig } from '@/api/useConfig'
import { useRoomData } from '@/features/rooms/livekit/hooks/useRoomData'
import { ApiAccessLevel } from '@/features/rooms/api/ApiRoom'
import { useTelephony } from '@/features/rooms/livekit/hooks/useTelephony'
import { formatPinCode } from '@/features/rooms/utils/telephony'
import { useCopyRoomToClipboard } from '@/features/rooms/livekit/hooks/useCopyRoomToClipboard'
import { inviteByEmail } from '@/features/rooms/api/inviteByEmail'

// fixme - extract in a proper primitive this dialog without overlay
const StyledRACDialog = styled(Dialog, {
  base: {
    position: 'fixed',
    left: '0.75rem',
    bottom: 80,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    width: '24.5rem',
    borderRadius: '8px',
    padding: '1.5rem',
    boxShadow:
      '0 1px 2px 0 rgba(60, 64, 67, .3), 0 2px 6px 2px rgba(60, 64, 67, .15)',
    backgroundColor: 'white',
    '&[data-entering]': { animation: 'fade 200ms' },
    '&[data-exiting]': { animation: 'fade 150ms reverse ease-in' },
  },
})

export const InviteDialog = (props: Omit<DialogProps, 'title'>) => {
  const { t } = useTranslation('rooms', { keyPrefix: 'shareDialog' })

  const roomData = useRoomData()
  const roomUrl = getRouteUrl('room', roomData?.slug)

  const { data: config } = useConfig()
  const emailInviteEnabled = !!config?.email_invite?.enabled && !!roomData?.slug

  const telephony = useTelephony()

  const isTelephonyReadyForUse = useMemo(() => {
    return telephony?.enabled && roomData?.pin_code
  }, [telephony?.enabled, roomData?.pin_code])

  const {
    isCopied,
    copyRoomToClipboard,
    isRoomUrlCopied,
    copyRoomUrlToClipboard,
  } = useCopyRoomToClipboard(roomData)

  return (
    <StyledRACDialog {...props}>
      {({ close }) => (
        <VStack
          alignItems="left"
          justify="start"
          gap={0}
          style={{ maxWidth: '100%', overflow: 'visible' }}
        >
          <Heading slot="title" level={2} className={text({ variant: 'h2' })}>
            {t('heading')}
          </Heading>
          <Div position="absolute" top="5" right="5">
            <Button
              invisible
              variant="tertiaryText"
              size="xs"
              onPress={() => {
                props.onClose?.()
                close()
              }}
              aria-label={t('closeDialog')}
            >
              <RiCloseLine />
            </Button>
          </Div>
          <P>{t('description')}</P>
          {isTelephonyReadyForUse ? (
            <div
              className={css({
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                marginTop: '0.5rem',
                gap: '1rem',
                overflow: 'visible',
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                })}
              >
                <Text as="p" wrap="pretty">
                  {roomUrl?.replace(/^https?:\/\//, '')}
                </Text>
                {isTelephonyReadyForUse && roomUrl && (
                  <Button
                    variant={isRoomUrlCopied ? 'success' : 'tertiaryText'}
                    square
                    size={'sm'}
                    onPress={copyRoomUrlToClipboard}
                    aria-label={isRoomUrlCopied ? t('copied') : t('copyUrl')}
                    tooltip={isRoomUrlCopied ? t('copied') : t('copyUrl')}
                  >
                    {isRoomUrlCopied ? (
                      <RiCheckLine aria-hidden="true" />
                    ) : (
                      <RiFileCopyLine aria-hidden="true" />
                    )}
                  </Button>
                )}
              </div>
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                })}
              >
                <Text as="p" wrap="pretty">
                  <Bold>{t('phone.call')}</Bold> ({telephony?.country}){' '}
                  {telephony?.internationalPhoneNumber}
                </Text>
                <Text as="p" wrap="pretty">
                  <Bold>{t('phone.pinCode')}</Bold>{' '}
                  {formatPinCode(roomData?.pin_code)}
                </Text>
              </div>

              <Button
                variant={isCopied ? 'success' : 'secondaryText'}
                size="sm"
                fullWidth
                aria-label={isCopied ? t('copied') : t('copy')}
                style={{
                  justifyContent: 'start',
                }}
                onPress={copyRoomToClipboard}
                data-attr="share-dialog-copy"
              >
                {isCopied ? (
                  <>
                    <RiCheckLine
                      size={18}
                      style={{ marginRight: '8px' }}
                      aria-hidden="true"
                    />
                    {t('copied')}
                  </>
                ) : (
                  <>
                    <RiFileCopyLine
                      style={{ marginRight: '6px', minWidth: '18px' }}
                      aria-hidden="true"
                    />
                    {t('copy')}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant={isCopied ? 'success' : 'tertiary'}
              fullWidth
              aria-label={isCopied ? t('copied') : t('copy')}
              onPress={copyRoomToClipboard}
              data-attr="share-dialog-copy"
            >
              {isCopied ? (
                <>
                  <RiCheckLine size={24} style={{ marginRight: '8px' }} />
                  {t('copied')}
                </>
              ) : (
                <>
                  <RiFileCopyLine size={24} style={{ marginRight: '8px' }} />
                  {t('copyUrl')}
                </>
              )}
            </Button>
          )}
          {emailInviteEnabled && <EmailInviteSection roomId={roomData!.slug!} />}
          {roomData?.access_level === ApiAccessLevel.PUBLIC && (
            <HStack>
              <div
                className={css({
                  backgroundColor: 'primary.200',
                  borderRadius: '50%',
                  padding: '4px',
                  marginTop: '1rem',
                })}
              >
                <RiSpam2Fill
                  size={22}
                  className={css({
                    fill: 'primary.500',
                  })}
                />
              </div>
              <Text variant="sm" style={{ marginTop: '1rem' }}>
                {t('permissions')}
              </Text>
            </HStack>
          )}
        </VStack>
      )}
    </StyledRACDialog>
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const parseEmails = (raw: string): string[] =>
  raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

const EmailInviteSection = ({ roomId }: { roomId: string }) => {
  const { t } = useTranslation('rooms', { keyPrefix: 'shareDialog.emailInvite' })
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (emails: string[]) => inviteByEmail({ roomId, emails }),
    onSuccess: () => setValue(''),
  })

  const submit = () => {
    setError(null)
    mutation.reset()
    const emails = parseEmails(value)
    if (emails.length === 0 || emails.some((e) => !EMAIL_RE.test(e))) {
      setError(t('invalidEmail'))
      return
    }
    mutation.mutate(emails)
  }

  return (
    <div
      className={css({
        width: '100%',
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid',
        borderColor: 'greyscale.200',
      })}
    >
      <Text variant="sm" className={css({ fontWeight: 600, display: 'block', marginBottom: '0.4rem' })}>
        {t('title')}
      </Text>
      <div className={css({ display: 'flex', gap: '0.5rem', alignItems: 'stretch' })}>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className={css({
            flex: 1,
            minWidth: 0,
            padding: '0.5rem 0.7rem',
            border: '1px solid',
            borderColor: 'greyscale.300',
            borderRadius: '8px',
            fontSize: '0.9rem',
            _focus: { borderColor: 'primary.500', outline: 'none' },
          })}
        />
        <Button
          variant="primary"
          size="sm"
          onPress={submit}
          isDisabled={mutation.isPending || value.trim() === ''}
          aria-label={t('send')}
        >
          <RiMailSendLine size={18} style={{ marginRight: '4px' }} aria-hidden="true" />
          {mutation.isPending ? t('sending') : t('send')}
        </Button>
      </div>
      <Text variant="xsNote" className={css({ display: 'block', marginTop: '0.35rem', color: 'greyscale.600' })}>
        {t('hint')}
      </Text>
      {error && (
        <Text variant="sm" className={css({ display: 'block', marginTop: '0.35rem', color: 'danger.600' })}>
          {error}
        </Text>
      )}
      {mutation.isError && (
        <Text variant="sm" className={css({ display: 'block', marginTop: '0.35rem', color: 'danger.600' })}>
          {t('error')}
        </Text>
      )}
      {mutation.isSuccess && (
        <Text variant="sm" className={css({ display: 'block', marginTop: '0.35rem', color: 'success.600' })}>
          {mutation.data.failed > 0
            ? t('partial', { sent: mutation.data.sent, failed: mutation.data.failed })
            : t('success', { count: mutation.data.sent })}
        </Text>
      )}
    </div>
  )
}
