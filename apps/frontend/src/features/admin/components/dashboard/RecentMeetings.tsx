import { useState } from 'react'
import { Link } from 'wouter'
import { css } from '@/styled-system/css'
import { MeetingDetailModal } from '../MeetingDetailModal'
import { Badge } from '@/components/console/ui'
import { formatDuration, formatDateTime } from '@/components/console/utils'

export const RecentMeetings = ({
  meetings,
}: {
  meetings: DashboardMeetingT[]
}) => {
  const [detailId, setDetailId] = useState<string | null>(null)
  return (
    <div
      className={css({
        backgroundColor: 'white',
        border: '1px solid',
        borderColor: 'greyscale.200',
        borderRadius: '16px',
        padding: '1.2rem',
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.9rem',
        })}
      >
        <h3 className={css({ fontSize: '1rem', fontWeight: 700 })}>
          Réunions récentes
        </h3>
        <Link
          to="/admin/meetings"
          className={css({
            fontSize: '0.85rem',
            color: 'primary.800',
            fontWeight: 600,
          })}
        >
          Voir toutes les réunions
        </Link>
      </div>
      {meetings.length === 0 ? (
        <div className={css({ color: 'greyscale.500', fontSize: '0.9rem' })}>
          Aucune réunion enregistrée pour l’instant. Les sessions apparaîtront
          ici dès qu’une réunion démarrera.
        </div>
      ) : (
        <div className={css({ overflowX: 'auto' })}>
          <table
            className={css({
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.88rem',
            })}
          >
            <thead>
              <tr
                className={css({ color: 'greyscale.500', textAlign: 'left' })}
              >
                <th className={th}>Réunion</th>
                <th className={th}>Organisateur</th>
                <th className={th}>Date et heure</th>
                <th className={th}>Durée</th>
                <th className={th}>Statut</th>
                <th className={th}>Participants</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr
                  key={m.id}
                  className={css({
                    borderTop: '1px solid',
                    borderColor: 'greyscale.100',
                  })}
                >
                  <td className={td}>
                    <button
                      type="button"
                      onClick={() => setDetailId(m.id)}
                      className={css({
                        fontWeight: 600,
                        color: 'primary.800',
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        textAlign: 'left',
                        font: 'inherit',
                        _hover: { textDecoration: 'underline' },
                      })}
                    >
                      {m.title}
                    </button>
                  </td>
                  <td className={td}>
                    {m.creator?.full_name || m.creator?.email || '—'}
                  </td>
                  <td className={td}>{formatDateTime(m.started_at)}</td>
                  <td className={td}>
                    {m.is_active ? '—' : formatDuration(m.duration_sec)}
                  </td>
                  <td className={td}>
                    {m.is_active ? (
                      <Badge tone="success">En cours</Badge>
                    ) : (
                      <Badge tone="neutral">Terminée</Badge>
                    )}
                  </td>
                  <td className={td}>{m.max_participants}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detailId && (
        <MeetingDetailModal id={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}

type DashboardMeetingT = {
  id: string
  title: string
  creator: { full_name: string; email: string } | null
  started_at: string
  duration_sec: number | null
  max_participants: number
  is_active: boolean
}

const th = css({
  padding: '0.6rem 0.8rem',
  fontWeight: 600,
  fontSize: '0.76rem',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  whiteSpace: 'nowrap',
})
const td = css({
  padding: '0.7rem 0.8rem',
  color: 'greyscale.800',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
})

/* ------------------------------------------------------------ system band -- */
