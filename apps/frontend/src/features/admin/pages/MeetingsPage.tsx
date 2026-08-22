import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { fetchAdminMeetings } from '../api/adminApi'
import { Badge, Pagination, Table, Th, Td } from '@/components/console/ui'
import { MeetingDetailModal } from '../components/MeetingDetailModal'
import { formatDateTime, formatDuration } from '@/components/console/utils'

export const MeetingsPage = () => {
  const [page, setPage] = useState(1)
  const [onlyActive, setOnlyActive] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'meetings', page, onlyActive],
    queryFn: () =>
      fetchAdminMeetings({ page, active: onlyActive ? 'true' : undefined }),
  })

  return (
    <div
      className={css({ display: 'flex', flexDirection: 'column', gap: '1rem' })}
    >
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
                  </Td>
                  <Td>{m.creator?.full_name || m.creator?.email || '—'}</Td>
                  <Td>{formatDateTime(m.started_at)}</Td>
                  <Td>{m.is_active ? '—' : formatDuration(m.duration_sec)}</Td>
                  <Td>{m.max_participants}</Td>
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
                      Aucune réunion enregistrée pour l’instant.
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

      {detailId && (
        <MeetingDetailModal id={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}
