import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { css } from '@/styled-system/css'
import { Badge, Pagination, Table, Th, Td } from '@/components/console/ui'
import { formatDateTime, formatDuration } from '@/components/console/utils'
import { fetchMyRecordings } from '../api/meApi'

/** A recording is only downloadable once the egress has finalized the file. */
const isReady = (status: string) => status === 'saved' || status === 'notification_succeeded'

const statusLabel = (status: string): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } => {
  if (isReady(status)) return { label: 'Disponible', tone: 'success' }
  if (status === 'active' || status === 'initiated') return { label: 'En cours', tone: 'warning' }
  if (status === 'stopped') return { label: 'Finalisation…', tone: 'warning' }
  if (status.startsWith('failed') || status === 'aborted') return { label: 'Échec', tone: 'danger' }
  return { label: status, tone: 'neutral' }
}

export const MyRecordingsPage = () => {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'recordings', page],
    queryFn: () => fetchMyRecordings({ page }),
  })

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1rem' })}>
      <p className={css({ color: 'greyscale.600', fontSize: '0.9rem', marginTop: '-0.5rem' })}>
        Les enregistrements des réunions auxquelles vous avez participé.
      </p>

      {isLoading ? (
        <div className={css({ color: 'greyscale.500' })}>Chargement…</div>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Réunion</Th>
                <Th>Date</Th>
                <Th>Durée</Th>
                <Th>Type</Th>
                <Th>Statut</Th>
                <Th>Expire le</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {data?.results.map((r) => {
                const status = statusLabel(r.status)
                const title = r.session?.title || r.room?.name || 'Réunion'
                return (
                  <tr key={r.id}>
                    <Td>
                      <span className={css({ fontWeight: 600 })}>{title}</span>
                      {r.is_owner && (
                        <span className={css({ marginLeft: '0.45rem' })}>
                          <Badge tone="info">Vous l’avez lancé</Badge>
                        </span>
                      )}
                    </Td>
                    <Td>{formatDateTime(r.session?.started_at ?? r.created_at)}</Td>
                    <Td>{formatDuration(r.session?.duration_sec)}</Td>
                    <Td>{r.mode === 'transcript' ? 'Transcription' : 'Vidéo'}</Td>
                    <Td>
                      {r.is_expired ? (
                        <Badge tone="neutral">Expiré</Badge>
                      ) : (
                        <Badge tone={status.tone}>{status.label}</Badge>
                      )}
                    </Td>
                    <Td>{r.expired_at ? formatDateTime(r.expired_at) : '—'}</Td>
                    <Td>
                      {isReady(r.status) && !r.is_expired ? (
                        <Link
                          to={`/recording/${r.id}`}
                          className={css({
                            color: 'primary.800',
                            fontWeight: 600,
                            textDecoration: 'underline',
                          })}
                        >
                          Ouvrir
                        </Link>
                      ) : (
                        '—'
                      )}
                    </Td>
                  </tr>
                )
              })}
              {data && data.results.length === 0 && (
                <tr>
                  <Td>
                    <span className={css({ color: 'greyscale.500' })}>
                      Aucun enregistrement pour vos réunions.
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
    </div>
  )
}
