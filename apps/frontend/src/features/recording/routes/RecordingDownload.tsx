import { useParams } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { Center, VStack } from '@/styled-system/jsx'
import { css } from '@/styled-system/css'
import { useTranslation } from 'react-i18next'
import { useTitle } from 'hoofd'
import { useMemo } from 'react'
import { apiUrl } from '@/api/apiUrl'
import { useUser } from '@/features/auth/api/useUser'
import { UserAware } from '@/features/auth/components/UserAware'
import { Screen } from '@/layout/Screen'
import { H, LinkButton, Text } from '@/primitives'
import { formatDate } from '@/utils/formatDate'
import { ErrorScreen } from '@/components/ErrorScreen'
import { LoadingScreen } from '@/components/LoadingScreen'
import { fetchRecording } from '../api/fetchRecording'
import { RecordingMode, RecordingStatus } from '@/features/recording'
import { useConfig } from '@/api/useConfig'

const APP_TITLE = import.meta.env.VITE_APP_TITLE ?? ''

const FALLBACK_ROOM_NAME = 'Réunion'

/**
 * Builds a filename the OS will accept: no path separators, reserved or
 * control characters, and never the literal "undefined".
 */
const toDownloadFilename = (roomName: string, createdAt: string) => {
  // eslint-disable-next-line no-control-regex
  const unsafe = /[\u0000-\u001f\u007f/\\:*?"<>|]+/g
  const safe = (value: string) =>
    value.replace(unsafe, '-').replace(/\s+/g, ' ').trim()
  const name = safe(roomName) || FALLBACK_ROOM_NAME
  const formatted = formatDate(createdAt, 'YYYY-MM-DD HH-mm')
  const date = formatted === 'Invalid Date' ? '' : safe(formatted)
  return date ? `${name}-${date}` : name
}

/**
 * Plays the recording in place. The media route serves byte ranges, so the
 * browser fetches only what it needs and seeking works; `preload="metadata"`
 * keeps the initial load to the header rather than the whole file.
 */
const RecordingPlayer = ({
  src,
  isAudio,
  label,
  fallback,
}: {
  src: string
  isAudio: boolean
  label: string
  fallback: string
}) => {
  const shared = {
    src,
    controls: true,
    preload: 'metadata' as const,
    'aria-label': label,
    className: css({
      width: '100%',
      borderRadius: '12px',
      backgroundColor: 'black',
      display: 'block',
    }),
  }
  return (
    <div
      className={css({
        width: '100%',
        maxWidth: '46rem',
        marginBottom: '1.25rem',
      })}
    >
      {/* jsx-a11y/media-has-caption is disabled below on purpose: no caption
          file is produced for meeting recordings today. An empty <track> would
          announce captions that do not exist, which misleads assistive tech more
          than their absence does. Generating them is the real fix. */}
      {isAudio ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio {...shared}>{fallback}</audio>
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video {...shared} playsInline>
          {fallback}
        </video>
      )}
    </div>
  )
}

const RecordingDownload = () => {
  const { t } = useTranslation('recording')
  const { data: configData } = useConfig()
  const { recordingId } = useParams()
  const { isLoggedIn, isLoading: isAuthLoading } = useUser()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['recording', recordingId],
    queryFn: () => fetchRecording({ recordingId }),
    retry: false,
    enabled: !!recordingId,
  })

  const isSaved =
    data?.status === RecordingStatus.Saved ||
    data?.status === RecordingStatus.NotificationSucceed ||
    data?.status === RecordingStatus.FailedToStop

  const pageTitle = useMemo(() => {
    if (isError) return `${APP_TITLE} - ${t('error.title')}`
    if (data && !isSaved) return `${APP_TITLE} - ${t('unsaved.title')}`
    if (data?.is_expired) return `${APP_TITLE} - ${t('expired.title')}`
    if (data && isSaved) return `${APP_TITLE} - ${t('success.title')}`
    return APP_TITLE
  }, [isError, data, isSaved, t])

  useTitle(pageTitle)

  if (isLoggedIn === undefined || isAuthLoading) {
    return <LoadingScreen />
  }

  if (isLoggedIn === false && !isAuthLoading) {
    return (
      <ErrorScreen
        title={t('authentication.title')}
        body={t('authentication.body')}
      />
    )
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  if (isError || !data) {
    return <ErrorScreen title={t('error.title')} body={t('error.body')} />
  }

  if (
    data.status !== RecordingStatus.Saved &&
    data.status !== RecordingStatus.NotificationSucceed &&
    data.status !== RecordingStatus.FailedToStop
  ) {
    return <ErrorScreen title={t('unsaved.title')} body={t('unsaved.body')} />
  }

  if (data.is_expired) {
    return (
      <ErrorScreen
        title={t('expired.title')}
        body={
          data.expired_at
            ? t('expired.body', {
                date: formatDate(data.expired_at, 'DD-MM-YYYY HH:mm'),
              })
            : t('expired.bodyNoDate')
        }
      />
    )
  }

  const roomName = data.room?.name?.trim() || FALLBACK_ROOM_NAME

  return (
    <UserAware>
      <Screen layout="centered" footer={false}>
        <Center>
          <VStack>
            <H lvl={1} centered>
              {t('success.title')}
            </H>
            <Text centered margin="md" wrap={'balance'}>
              <span>
                {t('success.body', {
                  room: roomName,
                  created_at: formatDate(data.created_at, 'DD-MM-YYYY HH:mm'),
                })}
              </span>
              <span>
                {configData?.recording?.expiration_days && (
                  <>
                    {' '}
                    {t('success.expiration', {
                      expiration_days: configData?.recording?.expiration_days,
                    })}
                  </>
                )}
              </span>
            </Text>
            <RecordingPlayer
              src={apiUrl(`recordings/${data.id}/media/`)}
              isAudio={data.mode === RecordingMode.Transcript}
              label={t('success.player.label')}
              fallback={t('success.player.unsupported')}
            />

            {/* ?download=1 flips the disposition back to `attachment`; without it
                the same URL now plays in the tab instead of saving. */}
            <LinkButton
              href={apiUrl(`recordings/${data.id}/media/?download=1`)}
              download={toDownloadFilename(roomName, data.created_at)}
            >
              {t('success.button')}
            </LinkButton>
          </VStack>
        </Center>
      </Screen>
    </UserAware>
  )
}

export default RecordingDownload
