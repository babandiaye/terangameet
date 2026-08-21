import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { RiCloseLine } from '@remixicon/react'
import { fetchAdminMeetings, fetchAdminMeeting } from '../api/adminApi'
import { Badge, Pagination, Table, Th, Td } from '@/components/console/ui'
import { formatDateTime, formatDuration, formatClock } from '@/components/console/utils'

export const MeetingsPage = () => {
  const [page, setPage] = useState(1)
  const [onlyActive, setOnlyActive] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'meetings', page, onlyActive],
    queryFn: () => fetchAdminMeetings({ page, active: onlyActive ? 'true' : undefined }),
  })

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1rem' })}>
      <label className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' })}>
        <input type="checkbox" checked={onlyActive} onChange={(e) => { setPage(1); setOnlyActive(e.target.checked) }} />
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
                <Th>Organisateur</Th>
                <Th>Début</Th>
                <Th>Durée</Th>
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
                      className={css({ fontWeight: 600, color: 'primary.800', cursor: 'pointer', background: 'none', border: 'none', padding: 0, textAlign: 'left' })}
                    >
                      {m.title}
                    </button>
                  </Td>
                  <Td>{m.creator?.full_name || m.creator?.email || '—'}</Td>
                  <Td>{formatDateTime(m.started_at)}</Td>
                  <Td>{m.is_active ? '—' : formatDuration(m.duration_sec)}</Td>
                  <Td>{m.max_participants}</Td>
                  <Td>
                    {m.is_active ? <Badge tone="success">En cours</Badge> : <Badge tone="neutral">Terminée</Badge>}
                  </Td>
                </tr>
              ))}
              {data && data.results.length === 0 && (
                <tr>
                  <Td>
                    <span className={css({ color: 'greyscale.500' })}>Aucune réunion enregistrée pour l’instant.</span>
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
          {data && <Pagination page={data.page} pageSize={data.page_size} count={data.count} onPage={setPage} />}
        </>
      )}

      {detailId && <MeetingDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}

const MeetingDetailModal = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const { data } = useQuery({ queryKey: ['admin', 'meeting', id], queryFn: () => fetchAdminMeeting(id) })
  return (
    <div
      onClick={onClose}
      className={css({
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      })}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={css({
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
            <h3 className={css({ fontSize: '1.2rem', fontWeight: 700 })}>{data?.title || 'Réunion'}</h3>
            {data && (
              <div className={css({ color: 'greyscale.600', fontSize: '0.88rem', marginTop: '0.2rem' })}>
                {formatDateTime(data.started_at)}
                {' · '}
                {data.is_active ? 'en cours' : `durée ${formatDuration(data.duration_sec)}`}
                {' · '}
                {data.creator?.full_name || data.creator?.email || 'Organisateur inconnu'}
              </div>
            )}
          </div>
          <button onClick={onClose} className={css({ cursor: 'pointer', background: 'none', border: 'none' })}>
            <RiCloseLine size={22} />
          </button>
        </div>

        <h4 className={css({ fontSize: '0.95rem', fontWeight: 700, margin: '1.1rem 0 0.6rem' })}>
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
