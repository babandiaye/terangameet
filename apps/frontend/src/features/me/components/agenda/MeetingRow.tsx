import { css } from '@/styled-system/css'
import { RiTeamLine } from '@remixicon/react'
import { Button } from '@/primitives'
import { Badge } from '@/components/console/ui'
import type { ScheduledMeeting } from '../../api/types'

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

export const MeetingRow = ({
  meeting: m,
  onEdit,
  onCancel,
  now,
}: {
  meeting: ScheduledMeeting
  onEdit: () => void
  onCancel: () => void
  now: number
}) => {
  const isLive =
    new Date(m.starts_at).getTime() - 10 * 60 * 1000 <= now &&
    now <= new Date(m.ends_at).getTime()
  const answers = {
    yes: m.attendees.filter((a) => a.response === 'accepted').length,
    no: m.attendees.filter((a) => a.response === 'declined').length,
    maybe: m.attendees.filter((a) => a.response === 'tentative').length,
  }
  const pending = m.attendees.length - answers.yes - answers.no - answers.maybe

  return (
    <li
      className={css({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem 1rem',
        padding: '0.85rem 1rem',
        border: '1px solid',
        borderColor: isLive ? 'primary.800' : 'greyscale.200',
        borderRadius: '12px',
        backgroundColor: 'white',
      })}
    >
      <div
        className={css({
          minWidth: '6.5rem',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        })}
      >
        {time(m.starts_at)} – {time(m.ends_at)}
      </div>
      <div className={css({ flex: '1 1 14rem', minWidth: 0 })}>
        <div className={css({ fontWeight: 700, overflowWrap: 'anywhere' })}>
          {m.title}
          {isLive && (
            <span className={css({ marginLeft: '0.45rem' })}>
              <Badge tone="success">Maintenant</Badge>
            </span>
          )}
        </div>
        <div
          className={css({
            color: 'greyscale.600',
            fontSize: '0.82rem',
            overflowWrap: 'anywhere',
          })}
        >
          {m.is_organizer
            ? 'Vous organisez'
            : `Organisé par ${m.organizer.full_name || m.organizer.email}`}
          {' · '}
          <RiTeamLine
            size={13}
            aria-hidden="true"
            style={{ display: 'inline', verticalAlign: '-2px' }}
          />{' '}
          {m.attendees.length} invité(s)
          {m.is_organizer && m.channel === 'google' && m.attendees.length > 0
            ? ` — ${answers.yes} oui · ${answers.no} non · ${answers.maybe} peut-être · ${pending} sans réponse`
            : ''}
          {' · '}
          {m.room.url.replace(/^https?:\/\//, '')}
          {m.channel === 'google' && (
            <span className={css({ marginLeft: '0.45rem' })}>
              <Badge tone="info">Google Agenda</Badge>
            </span>
          )}
        </div>
      </div>
      <div
        className={css({ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' })}
      >
        <a
          href={m.room.url}
          target="_blank"
          rel="noopener noreferrer"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.4rem 0.85rem',
            borderRadius: '10px',
            backgroundColor: 'primary.800',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.875rem',
            textDecoration: 'none',
            _hover: { backgroundColor: 'primary.action' },
          })}
        >
          Rejoindre
        </a>
        {m.is_organizer && (
          <>
            <Button size="sm" variant="secondary" onPress={onEdit}>
              Modifier
            </Button>
            <Button size="sm" variant="tertiaryText" onPress={onCancel}>
              Annuler
            </Button>
          </>
        )}
      </div>
    </li>
  )
}
