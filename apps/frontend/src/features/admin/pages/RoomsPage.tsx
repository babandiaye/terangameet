import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { RiSearchLine } from '@remixicon/react'
import { fetchAdminRooms } from '../api/adminApi'
import { Badge, Pagination, Table, Th, Td, SortableTh } from '@/components/console/ui'
import { formatDateTime } from '@/components/console/utils'

type SortField = 'name' | 'sessions' | 'recordings' | 'date'
type Order = 'asc' | 'desc'

const accessLabel = (a: string): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } => {
  if (a === 'public') return { label: 'Public', tone: 'success' }
  if (a === 'trusted') return { label: 'Approuvé', tone: 'warning' }
  if (a === 'restricted') return { label: 'Restreint', tone: 'danger' }
  return { label: a, tone: 'neutral' }
}

export const RoomsPage = () => {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortField>('date')
  const [order, setOrder] = useState<Order>('desc')
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'rooms', page, search, sort, order],
    queryFn: () => fetchAdminRooms({ page, search, sort, order }),
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
      <div className={css({ position: 'relative', maxWidth: '360px' })}>
        <RiSearchLine
          size={18}
          className={css({ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'greyscale.500' })}
        />
        <input
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value) }}
          placeholder="Rechercher une salle…"
          className={css({
            width: '100%',
            padding: '0.55rem 0.7rem 0.55rem 2.2rem',
            border: '1px solid',
            borderColor: 'greyscale.300',
            borderRadius: '8px',
            fontSize: '0.9rem',
            _focus: { borderColor: 'primary.500', outline: 'none' },
          })}
        />
      </div>

      {isLoading ? (
        <div className={css({ color: 'greyscale.500' })}>Chargement…</div>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <SortableTh active={sort === 'name'} order={order} onClick={() => toggleSort('name')}>
                  Salle
                </SortableTh>
                <Th>Propriétaire</Th>
                <Th>Accès</Th>
                <SortableTh active={sort === 'sessions'} order={order} onClick={() => toggleSort('sessions')}>
                  Réunions
                </SortableTh>
                <SortableTh
                  active={sort === 'recordings'}
                  order={order}
                  onClick={() => toggleSort('recordings')}
                >
                  Enregistrements
                </SortableTh>
                <SortableTh active={sort === 'date'} order={order} onClick={() => toggleSort('date')}>
                  Créée le
                </SortableTh>
              </tr>
            </thead>
            <tbody>
              {data?.results.map((r) => {
                const acc = accessLabel(r.access_level)
                return (
                  <tr key={r.id}>
                    <Td>
                      <span className={css({ fontWeight: 600 })}>{r.name}</span>
                    </Td>
                    <Td>{r.owner?.full_name || r.owner?.email || '—'}</Td>
                    <Td>
                      <Badge tone={acc.tone}>{acc.label}</Badge>
                    </Td>
                    <Td>{r.sessions}</Td>
                    <Td>{r.recordings}</Td>
                    <Td>{formatDateTime(r.created_at)}</Td>
                  </tr>
                )
              })}
              {data && data.results.length === 0 && (
                <tr>
                  <Td>
                    <span className={css({ color: 'greyscale.500' })}>Aucune salle.</span>
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
