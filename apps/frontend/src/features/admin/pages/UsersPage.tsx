import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { RiSearchLine } from '@remixicon/react'
import { Button, Dialog } from '@/primitives'
import { errorMessage } from '@/features/me/components/roomAccessLevels'
import { useUser } from '@/features/auth/api/useUser'
import { fetchAdminUsers, fetchAdminUser, patchAdminUser } from '../api/adminApi'
import type { AdminUserRow } from '../api/types'
import { Badge, Pagination, Table, Th, Td, LoadError } from '@/components/console/ui'
import { formatDateTime, formatDuration } from '@/components/console/utils'

export const UsersPage = () => {
  const qc = useQueryClient()
  const { user: me } = useUser()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: () => fetchAdminUsers({ page, search }),
  })

  // Promoting, demoting, deactivating: each is confirmed first, with what it
  // actually does, and a refusal from the server is shown in the dialog.
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { is_active?: boolean; is_admin?: boolean } }) =>
      patchAdminUser(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setPendingAction(null)
    },
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
      ) : isError ? (
        <LoadError what="la liste des utilisateurs" onRetry={() => refetch()} />
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
                  onToggleAdmin={() => setPendingAction({ user: u, kind: 'admin' })}
                  onToggleActive={() => setPendingAction({ user: u, kind: 'active' })}
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

      <UserDetailDialog id={detailId} onClose={() => setDetailId(null)} />
      <ConfirmUserAction
        action={pendingAction}
        isPending={mutation.isPending}
        error={mutation.error}
        onConfirm={(a) =>
          mutation.mutate({
            id: a.user.id,
            body: a.kind === 'admin' ? { is_admin: !a.user.is_admin } : { is_active: !a.user.is_active },
          })
        }
        onClose={() => {
          mutation.reset()
          setPendingAction(null)
        }}
      />
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

type PendingAction = { user: AdminUserRow; kind: 'admin' | 'active' }

/** What each change really does, said before it is done. */
const describeAction = ({ user, kind }: PendingAction) => {
  const who = user.full_name || user.email || 'Ce compte'
  if (kind === 'admin') {
    return user.is_admin
      ? {
          title: 'Retirer les droits d’administrateur ?',
          body: `${who} n’aura plus accès à la console d’administration.`,
          confirm: 'Retirer les droits',
        }
      : {
          title: 'Promouvoir administrateur ?',
          body: `${who} accédera à la console d’administration : comptes, salles (modification et suppression), enregistrements et paramètres de la plateforme.`,
          confirm: 'Promouvoir',
        }
  }
  return user.is_active
    ? {
        title: 'Désactiver ce compte ?',
        body: `${who} est déconnecté immédiatement, retiré des réunions en cours, et ne pourra plus se connecter tant que le compte n’est pas réactivé.`,
        confirm: 'Désactiver',
      }
    : {
        title: 'Réactiver ce compte ?',
        body: `${who} pourra de nouveau se connecter.`,
        confirm: 'Réactiver',
      }
}

const ConfirmUserAction = ({
  action,
  isPending,
  error,
  onConfirm,
  onClose,
}: {
  action: PendingAction | null
  isPending: boolean
  error: unknown
  onConfirm: (a: PendingAction) => void
  onClose: () => void
}) => {
  const text = action ? describeAction(action) : null
  return (
    <Dialog isOpen={!!action} onOpenChange={(open) => !open && onClose()} role="alertdialog" title={text?.title}>
      {action && text && (
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '1rem' })}>
          <p>{text.body}</p>
          {!!error && (
            <p role="alert" className={css({ color: 'danger.600', fontSize: '0.9rem' })}>
              {errorMessage(error, 'La modification n’a pas pu être enregistrée.')}
            </p>
          )}
          <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' })}>
            <Button variant="primary" onPress={() => onConfirm(action)} isDisabled={isPending}>
              {isPending ? 'Enregistrement…' : text.confirm}
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

const UserDetailDialog = ({ id, onClose }: { id: string | null; onClose: () => void }) => {
  const { data, isError, refetch } = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => fetchAdminUser(id!),
    enabled: !!id,
  })
  return (
    <Dialog
      isOpen={!!id}
      onOpenChange={(open) => !open && onClose()}
      type="flex"
      title={data?.full_name || 'Utilisateur'}
    >
      <div className={css({ width: 'min(34rem, calc(100vw - 5rem))', maxHeight: 'calc(100dvh - 11rem)', overflowY: 'auto' })}>
        {isError ? (
          <LoadError what="ce compte" onRetry={() => refetch()} />
        ) : !data ? (
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
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      gap: '0.25rem 1rem',
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
    </Dialog>
  )
}
