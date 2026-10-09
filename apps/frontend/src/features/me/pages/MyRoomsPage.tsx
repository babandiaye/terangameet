import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { RiAddLine } from '@remixicon/react'
import { Button, Dialog, Field, Form } from '@/primitives'
import { Badge, Pagination, Table, Th, Td } from '@/components/console/ui'
import { formatDateTime } from '@/components/console/utils'
import { createMyRoom, fetchMyRooms } from '../api/meApi'
import type { RoomAccessLevel } from '../api/types'
import { RoomDetailDialog } from '../components/RoomDetailDialog'
import {
  ACCESS_LEVELS,
  accessLevelLabel,
  errorMessage,
} from '../components/roomAccessLevels'

/**
 * "Salles de réunion" — the rooms the user organises. Each room keeps its link
 * for good; from here its title, access type and expected participants are
 * maintained between sessions.
 */
export const MyRoomsPage = () => {
  const [page, setPage] = useState(1)
  const [openRoomId, setOpenRoomId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['me', 'rooms', page],
    queryFn: () => fetchMyRooms({ page }),
  })

  return (
    <div
      className={css({ display: 'flex', flexDirection: 'column', gap: '1rem' })}
    >
      <div
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginTop: '-0.5rem',
        })}
      >
        <p
          className={css({
            color: 'greyscale.600',
            fontSize: '0.9rem',
            maxWidth: '36rem',
          })}
        >
          Les salles que vous organisez. Leur lien ne change jamais : modifiez
          leur titre, leur type d’accès et la liste des participants prévus
          entre deux séances.
        </p>
        <Button variant="primary" size="sm" onPress={() => setIsCreating(true)}>
          <RiAddLine size={18} aria-hidden="true" />
          Nouvelle salle
        </Button>
      </div>

      {isLoading ? (
        <div className={css({ color: 'greyscale.500' })}>Chargement…</div>
      ) : isError ? (
        <div role="alert" className={css({ color: 'danger.600' })}>
          Impossible de charger vos salles. Rechargez la page.
        </div>
      ) : !data?.results.length ? (
        <div className={css({ color: 'greyscale.600' })}>
          Vous n’organisez encore aucune salle. Créez-en une, ou démarrez une
          réunion depuis le tableau de bord.
        </div>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Salle</Th>
                <Th>Type</Th>
                <Th>Participants prévus</Th>
                <Th>Séances</Th>
                <Th>Dernière séance</Th>
                <Th>Rôle</Th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <button
                      type="button"
                      onClick={() => setOpenRoomId(r.id)}
                      className={css({
                        display: 'block',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'primary.800',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        _hover: { color: 'primary.action' },
                      })}
                    >
                      {r.name === r.slug ? 'Salle sans titre' : r.name}
                    </button>
                    <span
                      className={css({
                        color: 'greyscale.600',
                        fontSize: '0.8rem',
                      })}
                    >
                      {r.slug}
                    </span>
                    {r.is_active && (
                      <span className={css({ marginLeft: '0.45rem' })}>
                        <Badge tone="success">En cours</Badge>
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Badge
                      tone={r.access_level === 'public' ? 'neutral' : 'info'}
                    >
                      {accessLevelLabel(r.access_level)}
                    </Badge>
                  </Td>
                  <Td>{r.invitees_count}</Td>
                  <Td>{r.sessions_count}</Td>
                  <Td>
                    {r.last_session_at
                      ? formatDateTime(r.last_session_at)
                      : '—'}
                  </Td>
                  <Td>
                    {r.my_role === 'owner' ? 'Propriétaire' : 'Co-organisateur'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={page}
            pageSize={data.page_size}
            count={data.count}
            onPage={setPage}
          />
        </>
      )}

      <RoomDetailDialog
        roomId={openRoomId}
        onClose={() => setOpenRoomId(null)}
      />
      <CreateRoomDialog
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onCreated={(id) => {
          setIsCreating(false)
          setOpenRoomId(id)
        }}
      />
    </div>
  )
}

/** Title + access type; the participant list is filled in the detail that opens next. */
const CreateRoomDialog = ({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated: (roomId: string) => void
}) => {
  const queryClient = useQueryClient()
  const [accessLevel, setAccessLevel] = useState<RoomAccessLevel>('public')
  const create = useMutation({
    mutationFn: createMyRoom,
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ['me', 'rooms'] })
      setAccessLevel('public')
      onCreated(room.id)
    },
  })

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Nouvelle salle"
    >
      <Form
        onSubmit={(data) =>
          create.mutate({
            name: String(data.name ?? '').trim(),
            access_level: accessLevel,
          })
        }
        submitLabel="Créer la salle"
        submitButtonProps={{ isDisabled: create.isPending }}
        onCancelButtonPress={onClose}
      >
        {/* eslint-disable jsx-a11y/no-autofocus -- the title is the first thing asked */}
        <Field
          type="text"
          name="name"
          autoFocus
          isRequired
          maxLength={120}
          label="Titre de la salle"
          description="Ex. : Master LEPRAD. Le lien est généré automatiquement et ne changera pas."
        />
        <Field
          type="radioGroup"
          label="Type d’accès"
          value={accessLevel}
          onChange={(value) => setAccessLevel(value as RoomAccessLevel)}
          items={ACCESS_LEVELS.map((l) => ({
            value: l.value,
            label: l.label,
            description: l.description,
          }))}
        />
        {create.isError && (
          <p
            role="alert"
            className={css({ color: 'danger.600', marginBottom: '1rem' })}
          >
            {errorMessage(create.error, 'La salle n’a pas pu être créée.')}
          </p>
        )}
      </Form>
    </Dialog>
  )
}
