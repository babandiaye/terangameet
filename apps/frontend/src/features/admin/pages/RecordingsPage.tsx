import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { css } from '@/styled-system/css'
import { fetchAdminRecordings } from '../api/adminApi'
import { Badge, Pagination, Table, Th, Td, SortableTh } from '@/components/console/ui'
import { formatDateTime } from '@/components/console/utils'

const statusTone = (s: string): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (s === 'saved' || s === 'notification_succeeded') return 'success'
  if (s === 'active' || s === 'initiated') return 'warning'
  if (s.startsWith('failed') || s === 'aborted') return 'danger'
  return 'neutral'
}

type SortField = 'date' | 'user'
type Order = 'asc' | 'desc'

export const RecordingsPage = () => {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortField>('date')
  const [order, setOrder] = useState<Order>('desc')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'recordings', page, sort, order],
    queryFn: () => fetchAdminRecordings({ page, sort, order }),
  })

  // Toggle order when clicking the active column, else switch column (desc default).
  const toggleSort = (field: SortField) => {
    setPage(1)
    if (sort === field) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(field)
      setOrder('desc')
    }
  }

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1rem' })}>
      {isLoading ? (
        <div className={css({ color: 'greyscale.500' })}>Chargement…</div>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Salle</Th>
                <SortableTh active={sort === 'user'} order={order} onClick={() => toggleSort('user')}>
                  Propriétaire
                </SortableTh>
                <Th>Type</Th>
                <Th>Statut</Th>
                <SortableTh active={sort === 'date'} order={order} onClick={() => toggleSort('date')}>
                  Créé le
                </SortableTh>
                <Th>Expire le</Th>
                <Th>Lien</Th>
              </tr>
            </thead>
            <tbody>
              {data?.results.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <span className={css({ fontWeight: 600 })}>{r.room?.name || '—'}</span>
                  </Td>
                  <Td>{r.creator?.full_name || r.creator?.email || '—'}</Td>
                  <Td>{r.mode === 'transcript' ? 'Transcription' : 'Vidéo'}</Td>
                  <Td>
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  </Td>
                  <Td>{formatDateTime(r.created_at)}</Td>
                  <Td>{r.expired_at ? formatDateTime(r.expired_at) : '—'}</Td>
                  <Td>
                    {r.status === 'saved' || r.status === 'notification_succeeded' ? (
                      <Link
                        to={`/recording/${r.id}`}
                        className={css({ color: 'primary.800', fontWeight: 600, textDecoration: 'underline' })}
                      >
                        Ouvrir
                      </Link>
                    ) : (
                      '—'
                    )}
                  </Td>
                </tr>
              ))}
              {data && data.results.length === 0 && (
                <tr>
                  <Td>
                    <span className={css({ color: 'greyscale.500' })}>Aucun enregistrement.</span>
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
          {data && <Pagination page={data.page} pageSize={data.page_size} count={data.count} onPage={setPage} />}
        </>
      )}
    </div>
  )
}
