import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { Button } from '@/primitives'
import { fetchGoogleLink, unlinkGoogle } from '../../api/meApi'
import { useConfig } from '@/api/useConfig'
import { apiUrl } from '@/api/apiUrl'

/** What the return from Google's consent screen means for the person. */
const GOOGLE_OUTCOMES: Record<
  string,
  { tone: 'ok' | 'error'; text: string }
> = {
  connected: {
    tone: 'ok',
    text: 'Google Agenda relié. Vos prochaines réunions y seront créées directement.',
  },
  denied: {
    tone: 'error',
    text: 'Vous avez refusé l’accès : votre Google Agenda n’est pas relié.',
  },
  mismatch: {
    tone: 'error',
    text: 'Ce compte Google n’est pas celui de votre compte TerangaMeet. Choisissez votre adresse @unchk.edu.sn.',
  },
  unavailable: {
    tone: 'error',
    text: 'La synchronisation Google Agenda n’est pas activée sur la plateforme.',
  },
  error: {
    tone: 'error',
    text: 'La connexion à Google Agenda a échoué. Réessayez dans un instant.',
  },
}

/**
 * Link / unlink the user's Google Calendar. Shown only when an administrator
 * enabled the synchronisation (and the server has the Google credentials).
 */
export const GoogleCalendarCard = () => {
  const queryClient = useQueryClient()
  const { data: config } = useConfig()
  const available = !!config?.calendar?.google
  const { data: link } = useQuery({
    queryKey: ['me', 'google'],
    queryFn: fetchGoogleLink,
    enabled: available,
  })
  const [confirming, setConfirming] = useState(false)
  // Read once: the outcome of the consent screen we just came back from.
  const [outcome] = useState(() =>
    new URLSearchParams(window.location.search).get('google')
  )
  useEffect(() => {
    if (outcome)
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname
      )
  }, [outcome])
  const unlink = useMutation({
    mutationFn: unlinkGoogle,
    onSuccess: () => {
      setConfirming(false)
      queryClient.invalidateQueries({ queryKey: ['me', 'google'] })
    },
  })

  if (!available || !link) return null
  const message = outcome ? GOOGLE_OUTCOMES[outcome] : undefined

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        padding: '0.9rem 1rem',
        border: '1px solid',
        borderColor: 'greyscale.200',
        borderRadius: '12px',
        backgroundColor: 'greyscale.50',
      })}
    >
      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={css({
            fontSize: '0.9rem',
            fontWeight: 600,
            color: message.tone === 'ok' ? 'brand.green' : 'danger.600',
          })}
        >
          {message.text}
        </p>
      )}
      <div
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        })}
      >
        <div className={css({ minWidth: 0, flex: '1 1 18rem' })}>
          <div className={css({ fontWeight: 700 })}>Google Agenda</div>
          <div
            className={css({
              color: 'greyscale.600',
              fontSize: '0.88rem',
              overflowWrap: 'anywhere',
            })}
          >
            {link.connected
              ? `Relié à ${link.google_email}. Les réunions que vous planifiez sont créées dans votre Google Agenda, qui envoie les invitations et vous montre les réponses.`
              : 'Reliez votre Google Agenda : vos réunions y seront créées directement, Google enverra les invitations, et les réponses des invités apparaîtront ici.'}
          </div>
        </div>
        {link.connected ? (
          confirming ? (
            <div
              className={css({
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.4rem',
                alignItems: 'center',
              })}
            >
              <span className={css({ fontSize: '0.85rem' })}>
                Délier ? Les réunions déjà créées restent dans Google Agenda.
              </span>
              <Button
                size="sm"
                variant="primary"
                onPress={() => unlink.mutate()}
                isDisabled={unlink.isPending}
              >
                Délier
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => setConfirming(false)}
              >
                Garder
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onPress={() => setConfirming(true)}
            >
              Délier mon Google Agenda
            </Button>
          )
        ) : (
          <a
            href={apiUrl('/me/google/connect/')}
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.45rem 0.9rem',
              borderRadius: '10px',
              backgroundColor: 'primary.800',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
              _hover: { backgroundColor: 'primary.action' },
            })}
          >
            Connecter mon Google Agenda
          </a>
        )}
      </div>
      {unlink.isError && (
        <p
          role="alert"
          className={css({ fontSize: '0.85rem', color: 'danger.600' })}
        >
          Le lien n’a pas pu être retiré. Réessayez.
        </p>
      )}
    </div>
  )
}
