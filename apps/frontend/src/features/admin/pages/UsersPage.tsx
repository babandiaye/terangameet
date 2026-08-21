import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { RiSearchLine, RiCloseLine } from '@remixicon/react'
import { useUser } from '@/features/auth/api/useUser'
import { fetchAdminUsers, fetchAdminUser, patchAdminUser } from '../api/adminApi'
import type { AdminUserRow } from '../api/types'
import { Badge, Pagination, Table, Th, Td } from '@/components/console/ui'
import { formatDateTime, formatDuration } from '@/components/console/utils'

export const UsersPage = () => {
  const qc = useQueryClient()
  const { user: me } = useUser()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: () => fetchAdminUsers({ page, search }),
  })

  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { is_active?: boolean; is_admin?: boolean } }) =>
      patchAdminUser(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1rem' })}>
      {/* Search */}
      <div className={css({ position: 'relative', maxWidth: '360px' })}>
        <RiSearchLine
          size={18}
          className={css({ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'greyscale.500' })}
        />
        <input
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
          placeholder="Rechercher un nom ou un email…"
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
                <Th>Utilisateur</Th>
                <Th>Email</Th>
                <Th>Statut</Th>
                <Th>Réunions</Th>
                <Th>Inscrit le</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data?.results.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isMe={u.id === me?.id}
                  pending={mutation.isPending}
                  onToggleAdmin={() => mutation.mutate({ id: u.id, body: { is_admin: !u.is_admin } })}
                  onToggleActive={() => mutation.mutate({ id: u.id, body: { is_active: !u.is_active } })}
                  onDetail={() => setDetailId(u.id)}
                />
              ))}
              {data && data.results.length === 0 && (
                <tr>
                  <Td>
                    <span className={css({ color: 'greyscale.500' })}>Aucun utilisateur.</span>
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
          {data && (
            <Pagination page={data.page} pageSize={data.page_size} count={data.count} onPage={setPage} />
          )}
        </>
      )}

      {detailId && <UserDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}

const UserRow = ({
  user,
  isMe,
  pending,
  onToggleAdmin,
  onToggleActive,
  onDetail,
}: {
  user: AdminUserRow
  isMe: boolean
  pending: boolean
  onToggleAdmin: () => void
  onToggleActive: () => void
  onDetail: () => void
}) => (
  <tr className={css({ opacity: user.is_active ? 1 : 0.55 })}>
    <Td>
      <button
        onClick={onDetail}
        className={css({ fontWeight: 600, color: 'primary.800', cursor: 'pointer', background: 'none', border: 'none', padding: 0, textAlign: 'left' })}
      >
        {user.full_name || '—'}
      </button>
    </Td>
    <Td>{user.email || '—'}</Td>
    <Td>
      <div className={css({ display: 'flex', gap: '0.3rem' })}>
        {user.is_admin && <Badge tone="info">Admin</Badge>}
        <Badge tone={user.is_active ? 'success' : 'danger'}>{user.is_active ? 'Actif' : 'Inactif'}</Badge>
      </div>
    </Td>
    <Td>{user.meetings_created}</Td>
    <Td>{formatDateTime(user.created_at)}</Td>
    <Td>
      <div className={css({ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' })}>
        <ActionButton disabled={pending || isMe} onClick={onToggleAdmin}>
          {user.is_admin ? 'Retirer admin' : 'Promouvoir admin'}
        </ActionButton>
        <ActionButton disabled={pending || isMe} onClick={onToggleActive} tone={user.is_active ? 'danger' : 'default'}>
          {user.is_active ? 'Désactiver' : 'Activer'}
        </ActionButton>
      </div>
    </Td>
  </tr>
)

const ActionButton = ({
  children,
  onClick,
  disabled,
  tone = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={css({
      padding: '0.3rem 0.6rem',
      borderRadius: '6px',
      border: '1px solid',
      borderColor: tone === 'danger' ? 'danger.300' : 'greyscale.300',
      backgroundColor: 'white',
      color: tone === 'danger' ? 'danger.700' : 'greyscale.800',
      fontSize: '0.78rem',
      fontWeight: 600,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      _disabled: { opacity: 0.4, cursor: 'not-allowed' },
      _hover: { backgroundColor: 'greyscale.50' },
    })}
  >
    {children}
  </button>
)

const UserDetailModal = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const { data } = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => fetchAdminUser(id) })
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
          maxWidth: '560px',
          maxHeight: '85vh',
          overflowY: 'auto',
        })}
      >
        <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'start' })}>
          <h3 className={css({ fontSize: '1.2rem', fontWeight: 700 })}>{data?.full_name || 'Utilisateur'}</h3>
          <button onClick={onClose} className={css({ cursor: 'pointer', background: 'none', border: 'none' })}>
            <RiCloseLine size={22} />
          </button>
        </div>
        {!data ? (
          <div className={css({ color: 'greyscale.500', marginTop: '1rem' })}>Chargement…</div>
        ) : (
          <>
            <div className={css({ color: 'greyscale.600', fontSize: '0.9rem', marginBottom: '0.3rem' })}>{data.email}</div>
            <div className={css({ display: 'flex', gap: '0.3rem', marginBottom: '1rem' })}>
              {data.is_admin && <Badge tone="info">Admin</Badge>}
              <Badge tone={data.is_active ? 'success' : 'danger'}>{data.is_active ? 'Actif' : 'Inactif'}</Badge>
            </div>
            <div className={css({ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.9rem' })}>
              <div>
                <div className={css({ color: 'greyscale.500', fontSize: '0.75rem' })}>Réunions créées</div>
                <div className={css({ fontWeight: 700, fontSize: '1.2rem' })}>{data.meetings_created}</div>
              </div>
              <div>
                <div className={css({ color: 'greyscale.500', fontSize: '0.75rem' })}>Salles</div>
                <div className={css({ fontWeight: 700, fontSize: '1.2rem' })}>{data.rooms}</div>
              </div>
            </div>
            <h4 className={css({ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' })}>Dernières réunions</h4>
            {data.recent_sessions.length === 0 ? (
              <div className={css({ color: 'greyscale.500', fontSize: '0.9rem' })}>Aucune réunion.</div>
            ) : (
              <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.4rem' })}>
                {data.recent_sessions.map((s) => (
                  <div
                    key={s.id}
                    className={css({
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem',
                      padding: '0.5rem 0.7rem',
                      backgroundColor: 'greyscale.50',
                      borderRadius: '8px',
                    })}
                  >
                    <span className={css({ fontWeight: 500 })}>{s.title}</span>
                    <span className={css({ color: 'greyscale.600' })}>
                      {formatDateTime(s.started_at)} · {formatDuration(s.duration_sec)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
