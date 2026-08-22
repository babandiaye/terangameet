import { useEffect, useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { RiCloseLine } from '@remixicon/react'
import { fetchAdminMeeting } from '../api/adminApi'
import { Badge, Table, Th, Td } from '@/components/console/ui'
import {
  formatDateTime,
  formatDuration,
  formatClock,
} from '@/components/console/utils'

/**
 * Attendance sheet for one meeting: who joined, when they came and went.
 *
 * Shared by the meetings history and the dashboard's recent-meetings table so
 * that clicking a meeting title behaves identically in both places.
 */
export const MeetingDetailModal = ({
  id,
  onClose,
}: {
  id: string
  onClose: () => void
}) => {
  const { data } = useQuery({
    queryKey: ['admin', 'meeting', id],
    queryFn: () => fetchAdminMeeting(id),
  })
  const titleId = useId()

  // A dialog you can only leave with the mouse is a trap for keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={css({
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      })}
    >
      {/* The backdrop is a real button rather than a div with a click handler:
          it earns a keyboard path and a name, and being a sibling of the panel
          it needs no stopPropagation to avoid swallowing clicks inside. */}
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className={css({
          position: 'absolute',
          inset: 0,
          border: 'none',
          cursor: 'default',
          backgroundColor: 'rgba(0,0,0,0.4)',
        })}
      />
      <div
        className={css({
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: '14px',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '85vh',
          overflowY: 'auto',
        })}
      >
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            gap: '1rem',
          })}
        >
          <div>
            <h3
              id={titleId}
              className={css({ fontSize: '1.2rem', fontWeight: 700 })}
            >
              {data?.title || 'Réunion'}
            </h3>
            {data && (
              <div
                className={css({
                  color: 'greyscale.600',
                  fontSize: '0.88rem',
                  marginTop: '0.2rem',
                })}
              >
                {formatDateTime(data.started_at)}
                {' · '}
                {data.is_active
                  ? 'en cours'
                  : `durée ${formatDuration(data.duration_sec)}`}
                {' · '}
                {data.creator?.full_name ||
                  data.creator?.email ||
                  'Organisateur inconnu'}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className={css({
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              flexShrink: 0,
            })}
          >
            <RiCloseLine size={22} />
          </button>
        </div>

        <h4
          className={css({
            fontSize: '0.95rem',
            fontWeight: 700,
            margin: '1.1rem 0 0.6rem',
          })}
        >
          Participants {data ? `(${data.participants.length})` : ''}
        </h4>

        {!data ? (
          <div className={css({ color: 'greyscale.500' })}>Chargement…</div>
        ) : data.participants.length === 0 ? (
          <div className={css({ color: 'greyscale.500', fontSize: '0.9rem' })}>
            Aucun participant enregistré pour cette réunion.
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Participant</Th>
                <Th>Entrée</Th>
                <Th>Sortie</Th>
                <Th>Durée</Th>
              </tr>
            </thead>
            <tbody>
              {data.participants.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <span className={css({ fontWeight: 600 })}>{p.name}</span>
                  </Td>
                  <Td>{formatClock(p.first_joined_at)}</Td>
                  <Td>
                    {p.still_present ? (
                      <Badge tone="success">Présent</Badge>
                    ) : (
                      formatClock(p.last_left_at)
                    )}
                  </Td>
                  <Td>
                    {p.still_present ? '—' : formatDuration(p.duration_sec)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  )
}
