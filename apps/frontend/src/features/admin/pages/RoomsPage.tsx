import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { RiDeleteBinLine, RiSearchLine } from '@remixicon/react'
import { Button, Dialog } from '@/primitives'
import { deleteAdminRoom, fetchAdminRooms } from '../api/adminApi'
import type { AdminRoom } from '../api/types'
import { errorMessage } from '@/features/me/components/roomAccessLevels'
import { RoomDetailDialog } from '@/features/me/components/RoomDetailDialog'
import { Badge, Pagination, Table, Th, Td, SortableTh, LoadError } from '@/components/console/ui'
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
  const [toDelete, setToDelete] = useState<AdminRoom | null>(null)
  const [toEdit, setToEdit] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
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
      ) : isError ? (
        <LoadError what="les salles" onRetry={() => refetch()} />
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
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {data?.results.map((r) => {
                const acc = accessLabel(r.access_level)
                return (
                  <tr key={r.id}>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setToEdit(r.id)}
                        title="Modifier la salle"
                        className={css({
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontWeight: 600,
                          color: 'primary.800',
                          textDecoration: 'underline',
                          _hover: { color: 'primary.action' },
                        })}
                      >
                        {r.name}
                      </button>
                    </Td>
                    <Td>{r.owner?.full_name || r.owner?.email || '—'}</Td>
                    <Td>
                      <Badge tone={acc.tone}>{acc.label}</Badge>
                    </Td>
                    <Td>{r.sessions}</Td>
                    <Td>{r.recordings}</Td>
                    <Td>{formatDateTime(r.created_at)}</Td>
                    <Td>
                      <Button
                        size="sm"
                        variant="tertiaryText"
                        square
                        aria-label={`Supprimer la salle ${r.name}`}
                        tooltip="Supprimer la salle"
                        onPress={() => setToDelete(r)}
                      >
                        <RiDeleteBinLine size={18} aria-hidden="true" />
                      </Button>
                    </Td>
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
      <DeleteRoomDialog room={toDelete} onClose={() => setToDelete(null)} />
      {/* Same editor as "Mon espace", opened with administrator powers. */}
      <RoomDetailDialog
        roomId={toEdit}
        onClose={() => {
          setToEdit(null)
          queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] })
        }}
      />
    </div>
  )
}

/**
 * Deleting a room is reserved to administrators: its link stops working for
 * everyone who has it, and its recordings go with it. Both are spelled out
 * before the button is pressed.
 */
const DeleteRoomDialog = ({ room, onClose }: { room: AdminRoom | null; onClose: () => void }) => {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: (id: string) => deleteAdminRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] })
      onClose()
    },
  })

  return (
    <Dialog
      isOpen={!!room}
      onOpenChange={(open) => {
        if (!open) {
          remove.reset()
          onClose()
        }
      }}
      role="alertdialog"
      title="Supprimer cette salle ?"
    >
      {room && (
        <div>
          <p className={css({ marginBottom: '0.75rem' })}>
            <strong>{room.name}</strong>
            {room.slug && room.slug !== room.name ? ` (${room.slug})` : ''} — le lien cessera de
            fonctionner pour tous ceux qui l’ont reçu.
          </p>
          <ul className={css({ paddingLeft: '1.2rem', marginBottom: '1rem', listStyle: 'disc' })}>
            <li>
              {room.recordings > 0
                ? `${room.recordings} enregistrement(s) seront définitivement supprimés, fichiers compris.`
                : 'Aucun enregistrement n’est attaché à cette salle.'}
            </li>
            <li>L’historique des {room.sessions} séance(s) est conservé.</li>
          </ul>
          {remove.isError && (
            <p role="alert" className={css({ color: 'danger.600', marginBottom: '0.75rem' })}>
              {errorMessage(remove.error, 'La salle n’a pas pu être supprimée.')}
            </p>
          )}
          <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' })}>
            <Button variant="primary" onPress={() => remove.mutate(room.id)} isDisabled={remove.isPending}>
              {remove.isPending ? 'Suppression…' : 'Supprimer définitivement'}
            </Button>
            <Button variant="secondary" onPress={onClose}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
