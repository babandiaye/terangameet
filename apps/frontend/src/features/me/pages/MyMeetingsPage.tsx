import { useEffect, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { RiCloseLine } from '@remixicon/react'
import { Badge, Pagination, Table, Th, Td } from '@/components/console/ui'
import { formatClock, formatDateTime, formatDuration } from '@/components/console/utils'
import { fetchMyMeeting, fetchMyMeetings } from '../api/meApi'

export const MyMeetingsPage = () => {
  const [page, setPage] = useState(1)
  const [onlyActive, setOnlyActive] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'meetings', page, onlyActive],
    queryFn: () => fetchMyMeetings({ page, active: onlyActive ? 'true' : undefined }),
  })

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1rem' })}>
      <p className={css({ color: 'greyscale.600', fontSize: '0.9rem', marginTop: '-0.5rem' })}>
        Les réunions auxquelles vous avez pris part, avec votre temps de présence.
      </p>

      <label
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
          cursor: 'pointer',
        })}
      >
        <input
          type="checkbox"
          checked={onlyActive}
          onChange={(e) => {
            setPage(1)
            setOnlyActive(e.target.checked)
          }}
        />
        Afficher uniquement les réunions en cours
      </label>

      {isLoading ? (
        <div className={css({ color: 'greyscale.500' })}>Chargement…</div>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Réunion</Th>
                <Th>Date</Th>
                <Th>Durée totale</Th>
                <Th>Ma présence</Th>
                <Th>Participants</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {data?.results.map((m) => (
                <tr key={m.id}>
                  <Td>
                    <button
                      onClick={() => setDetailId(m.id)}
                      className={css({
                        fontWeight: 600,
                        color: 'primary.800',
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        textAlign: 'left',
                      })}
                    >
                      {m.title}
                    </button>
                    {m.has_recording && (
                      <span className={css({ marginLeft: '0.45rem' })}>
                        <Badge tone="info">Enregistrée</Badge>
                      </span>
                    )}
                  </Td>
                  <Td>{formatDateTime(m.started_at)}</Td>
                  <Td>{m.is_active ? '—' : formatDuration(m.duration_sec)}</Td>
                  <Td>{m.me.duration_sec === null ? '—' : formatDuration(m.me.duration_sec)}</Td>
                  <Td>{m.participants}</Td>
                  <Td>
                    {m.is_active ? (
                      <Badge tone="success">En cours</Badge>
                    ) : (
                      <Badge tone="neutral">Terminée</Badge>
                    )}
                  </Td>
                </tr>
              ))}
              {data && data.results.length === 0 && (
                <tr>
                  <Td>
                    <span className={css({ color: 'greyscale.500' })}>
                      Vous n’avez encore participé à aucune réunion.
                    </span>
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
          {data && (
            <Pagination
              page={data.page}
              pageSize={data.page_size}
              count={data.count}
              onPage={setPage}
            />
          )}
        </>
      )}

      {detailId && <MyMeetingDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}

const MyMeetingDetailModal = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const { data } = useQuery({ queryKey: ['me', 'meeting', id], queryFn: () => fetchMyMeeting(id) })
  const titleId = useId()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
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
      {/* Real button rather than a click handler on the overlay: dismissing the
          dialog stays reachable by keyboard and to assistive technology. */}
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className={css({
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          cursor: 'default',
          backgroundColor: 'rgba(0,0,0,0.4)',
        })}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
        <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'start' })}>
          <div>
            <h3 id={titleId} className={css({ fontSize: '1.2rem', fontWeight: 700 })}>
              {data?.title || 'Réunion'}
            </h3>
            {data && (
              <div className={css({ color: 'greyscale.600', fontSize: '0.88rem', marginTop: '0.2rem' })}>
                {formatDateTime(data.started_at)}
                {' · '}
                {data.is_active ? 'en cours' : `durée ${formatDuration(data.duration_sec)}`}
                {' · '}
                {data.me.duration_sec === null
                  ? 'présence en cours'
                  : `votre présence ${formatDuration(data.me.duration_sec)}`}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={css({ cursor: 'pointer', background: 'none', border: 'none' })}
          >
            <RiCloseLine size={22} />
          </button>
        </div>

        <h4 className={css({ fontSize: '0.95rem', fontWeight: 700, margin: '1.1rem 0 0.6rem' })}>
          Participants {data ? `(${data.participants.length})` : ''}
        </h4>

        {!data ? (
          <div className={css({ color: 'greyscale.500' })}>Chargement…</div>
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
                    {p.is_me && (
                      <span className={css({ marginLeft: '0.45rem' })}>
                        <Badge tone="info">Vous</Badge>
                      </span>
                    )}
                  </Td>
                  <Td>{formatClock(p.first_joined_at)}</Td>
                  <Td>
                    {p.still_present ? <Badge tone="success">Présent</Badge> : formatClock(p.last_left_at)}
                  </Td>
                  <Td>{p.still_present ? '—' : formatDuration(p.duration_sec)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  )
}
