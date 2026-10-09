import { css } from '@/styled-system/css'
import { Link } from 'wouter'
import { Button } from '@/primitives'
import { RoomLink } from '@/components/console/RoomLink'
import type { MailReport, ScheduledMeeting } from '../../api/types'
import { note } from './styles'

/**
 * Shown once a meeting is planned: when it opened from the « Créer une
 * réunion » menu, this replaces the old « date ultérieure » link screen —
 * same link to copy, plus where the invitations went.
 */
export const CreatedConfirmation = ({
  meeting,
  mail,
  onClose,
}: {
  meeting: ScheduledMeeting
  mail: MailReport
  onClose: () => void
}) => {
  const when = new Date(meeting.starts_at).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        marginTop: '0.5rem',
      })}
    >
      <p className={css({ fontWeight: 700, fontSize: '1.05rem' })}>
        {meeting.title}
      </p>
      <p className={note}>{when.charAt(0).toUpperCase() + when.slice(1)}</p>
      <RoomLink slug={meeting.room.slug} />
      <p className={css({ fontSize: '0.9rem' })}>
        {meeting.attendees.length === 0
          ? 'Aucun invité : partagez le lien ci-dessus, ou ajoutez des invités depuis l’agenda.'
          : mail.via === 'google'
            ? `Réunion créée dans votre Google Agenda : Google envoie l’invitation à ${meeting.attendees.length} invité(s).`
            : `Invitation envoyée par email à ${meeting.attendees.filter((a) => !mail.failed.includes(a.email)).length} invité(s).`}
      </p>
      {mail.failed.length > 0 && (
        <p
          role="alert"
          className={css({ color: 'danger.600', fontSize: '0.9rem' })}
        >
          L’envoi a échoué pour : {mail.failed.join(', ')}.
        </p>
      )}
      <div
        className={css({ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' })}
      >
        <Link
          to="/mon-espace/agenda"
          onClick={onClose}
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.5rem 1rem',
            borderRadius: '10px',
            backgroundColor: 'primary.800',
            color: 'white',
            fontWeight: 600,
            textDecoration: 'none',
            _hover: { backgroundColor: 'primary.action' },
          })}
        >
          Voir dans l’agenda
        </Link>
        <Button variant="secondary" onPress={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  )
}
