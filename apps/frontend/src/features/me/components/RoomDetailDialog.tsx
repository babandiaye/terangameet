import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Label } from 'react-aria-components'
import { css } from '@/styled-system/css'
import { RiDeleteBinLine, RiMailSendLine } from '@remixicon/react'
import { Button, Dialog, Field, TextArea } from '@/primitives'
import { Badge } from '@/components/console/ui'
import { RoomLink } from '@/components/console/RoomLink'
import {
  addInvitees,
  fetchMyRoom,
  inviteAll,
  removeInvitee,
  searchPeople,
  setCoOrganizer,
  updateRoom,
} from '../api/meApi'
import type { MyRoomDetail, RoomAccessLevel, RoomInvitee } from '../api/types'
import { ACCESS_LEVELS, errorMessage } from './roomAccessLevels'
import { InviteePicker } from './InviteePicker'

const sectionTitle = css({
  fontSize: '0.95rem',
  fontWeight: 700,
  margin: '1.5rem 0 0.5rem',
})
const note = css({ color: 'greyscale.600', fontSize: '0.85rem' })
const errorText = css({
  color: 'danger.600',
  fontSize: '0.85rem',
  marginTop: '0.35rem',
})
const successText = css({
  color: 'brand.green',
  fontSize: '0.85rem',
  marginTop: '0.35rem',
})

/**
 * Everything an organiser maintains about one room: title, access type,
 * expected participants (by email, co-organizers among them) and a one-click
 * invitation to the whole list. The link itself never changes.
 */
export const RoomDetailDialog = ({
  roomId,
  onClose,
}: {
  roomId: string | null
  onClose: () => void
}) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me', 'room', roomId],
    queryFn: () => fetchMyRoom(roomId!),
    enabled: !!roomId,
  })

  return (
    <Dialog
      isOpen={!!roomId}
      onOpenChange={(open) => !open && onClose()}
      // "flex": no fixed 30rem box — the content below sets the width.
      type="flex"
      title={
        data
          ? data.name === data.slug
            ? 'Salle sans titre'
            : data.name
          : 'Salle'
      }
    >
      <div
        className={css({
          // Never wider than the screen, and scrolls inside the dialog when the
          // participant list grows instead of running off the bottom.
          width: 'min(42rem, calc(100vw - 5rem))',
          maxHeight: 'calc(100dvh - 11rem)',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: '0.25rem',
        })}
      >
        {isLoading ? (
          <p className={note}>Chargement…</p>
        ) : isError || !data ? (
          <p role="alert" className={errorText}>
            Cette salle est introuvable ou ne vous est plus accessible.
          </p>
        ) : (
          <RoomDetail room={data} />
        )}
      </div>
    </Dialog>
  )
}

const RoomDetail = ({ room }: { room: MyRoomDetail }) => {
  const queryClient = useQueryClient()
  // Owner powers (co-organizers, removing them): the owner, and platform
  // administrators editing from the console.
  const isOwner = room.my_role !== 'co_organizer'

  /** Keep the detail and the list in step after any change. */
  const refresh = (invitees?: RoomInvitee[]) => {
    if (invitees) {
      queryClient.setQueryData<MyRoomDetail>(['me', 'room', room.id], (old) =>
        old ? { ...old, invitees } : old
      )
    } else {
      queryClient.invalidateQueries({ queryKey: ['me', 'room', room.id] })
    }
    queryClient.invalidateQueries({ queryKey: ['me', 'rooms'] })
  }

  return (
    <>
      <RoomLink slug={room.slug} />
      {room.my_role === 'co_organizer' && room.owner && (
        <p className={note} style={{ marginTop: '0.5rem' }}>
          Vous êtes co-organisateur de cette salle, qui appartient à{' '}
          {room.owner.full_name || room.owner.email}.
        </p>
      )}
      {room.my_role === 'admin' && (
        <p
          className={css({
            marginTop: '0.75rem',
            padding: '0.6rem 0.8rem',
            borderRadius: '10px',
            backgroundColor: 'primary.100',
            color: 'primary.800',
            fontSize: '0.85rem',
          })}
        >
          Vous modifiez cette salle en tant qu’administrateur de la plateforme.
          Propriétaire :{' '}
          {room.owner ? room.owner.full_name || room.owner.email : 'inconnu'}.
        </p>
      )}

      <NameSection room={room} onSaved={() => refresh()} />
      <AccessSection room={room} onSaved={() => refresh()} />
      <InviteesSection room={room} isOwner={isOwner} onChanged={refresh} />
      {room.email_enabled && <InviteAllSection room={room} />}
    </>
  )
}

const NameSection = ({
  room,
  onSaved,
}: {
  room: MyRoomDetail
  onSaved: () => void
}) => {
  const initial = room.name === room.slug ? '' : room.name
  const [name, setName] = useState(initial)
  useEffect(() => setName(initial), [initial])
  const save = useMutation({
    mutationFn: () => updateRoom(room.id, { name: name.trim() }),
    onSuccess: onSaved,
  })
  const isDirty = name.trim() !== '' && name.trim() !== initial

  return (
    <section className={css({ marginTop: '1.25rem' })}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (isDirty) save.mutate()
        }}
        className={css({
          // Field and button on one row, bottoms aligned; stacked when narrow.
          display: 'grid',
          gridTemplateColumns: { base: '1fr', sm: 'minmax(0, 1fr) auto' },
          alignItems: 'end',
          gap: '0.5rem',
        })}
      >
        <div className={css({ minWidth: 0 })}>
          <Field
            type="text"
            label="Titre de la salle"
            value={name}
            onChange={setName}
            maxLength={120}
            wrapperProps={{ noMargin: true, fullWidth: true }}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          isDisabled={!isDirty || save.isPending}
        >
          Enregistrer
        </Button>
      </form>
      {save.isError && (
        <p role="alert" className={errorText}>
          {errorMessage(save.error, 'Le titre n’a pas pu être enregistré.')}
        </p>
      )}
      {save.isSuccess && !isDirty && (
        <p role="status" className={successText}>
          Titre enregistré. Une séance en cours l’affiche immédiatement.
        </p>
      )}
    </section>
  )
}

const AccessSection = ({
  room,
  onSaved,
}: {
  room: MyRoomDetail
  onSaved: () => void
}) => {
  const save = useMutation({
    mutationFn: (accessLevel: RoomAccessLevel) =>
      updateRoom(room.id, { access_level: accessLevel }),
    onSuccess: onSaved,
  })

  return (
    <section>
      <h3 className={sectionTitle}>Type d’accès</h3>
      <Field
        type="radioGroup"
        label="Qui entre directement dans la salle ?"
        value={save.isPending ? save.variables : room.access_level}
        onChange={(value) => save.mutate(value as RoomAccessLevel)}
        isDisabled={save.isPending}
        items={ACCESS_LEVELS.map((l) => ({
          value: l.value,
          label: l.label,
          description: l.description,
        }))}
        wrapperProps={{ noMargin: true }}
      />
      {save.isError && (
        <p role="alert" className={errorText}>
          {errorMessage(save.error, 'Le type d’accès n’a pas pu être modifié.')}
        </p>
      )}
    </section>
  )
}

const InviteesSection = ({
  room,
  isOwner,
  onChanged,
}: {
  room: MyRoomDetail
  isOwner: boolean
  onChanged: (invitees: RoomInvitee[]) => void
}) => {
  const [asCoOrganizer, setAsCoOrganizer] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const add = useMutation({
    mutationFn: (email: string) =>
      addInvitees(room.id, { emails: email, is_co_organizer: asCoOrganizer }),
    onSuccess: (result, email) => {
      onChanged(result.invitees)
      setFeedback(
        result.added.length
          ? `${email} ajouté${asCoOrganizer ? ' comme co-organisateur' : ''}.`
          : `${email} est déjà dans la liste.`
      )
    },
  })
  const toggle = useMutation({
    mutationFn: (i: RoomInvitee) =>
      setCoOrganizer(room.id, i.id, !i.is_co_organizer),
    onSuccess: (result) => onChanged(result.invitees),
  })
  const remove = useMutation({
    mutationFn: (i: RoomInvitee) => removeInvitee(room.id, i.id),
    onSuccess: (result) => onChanged(result.invitees),
  })

  const lastError = add.error ?? toggle.error ?? remove.error

  return (
    <section>
      <h3 className={sectionTitle}>
        Participants prévus ({room.invitees.length}/{room.max_invitees})
      </h3>
      <p className={note}>
        {room.access_level === 'restricted'
          ? 'Ces personnes entrent sans attendre en se connectant avec cette adresse ; les autres passent par la salle d’attente.'
          : 'Dans une salle restreinte, ces personnes entrent sans attendre. Ici, la liste sert surtout à envoyer l’invitation.'}{' '}
        Les co-organisateurs animent chaque séance : ils admettent, coupent les
        micros, enregistrent et gèrent cette salle.
      </p>

      <div className={css({ marginTop: '0.75rem' })}>
        <InviteePicker
          id={`room-${room.id}`}
          search={(q) => searchPeople(room.id, q)}
          isAdding={add.isPending}
          onPick={(email) => {
            setFeedback(null)
            add.mutate(email)
          }}
        />
        {isOwner && (
          <div className={css({ marginTop: '0.5rem' })}>
            <Field
              type="checkbox"
              label="Ajouter comme co-organisateurs"
              isSelected={asCoOrganizer}
              onChange={setAsCoOrganizer}
              wrapperProps={{ noMargin: true }}
            />
          </div>
        )}
      </div>
      <div aria-live="polite">
        {feedback && <p className={successText}>{feedback}</p>}
        {lastError && (
          <p role="alert" className={errorText}>
            {errorMessage(lastError, 'La liste n’a pas pu être mise à jour.')}
          </p>
        )}
      </div>

      {room.invitees.length > 0 && (
        <ul
          className={css({
            listStyle: 'none',
            margin: '0.75rem 0 0',
            padding: 0,
            border: '1px solid',
            borderColor: 'greyscale.200',
            borderRadius: '10px',
            maxHeight: '18rem',
            overflowY: 'auto',
          })}
        >
          {room.invitees.map((i) => (
            <li
              key={i.id}
              className={css({
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.25rem 0.75rem',
                padding: '0.55rem 0.75rem',
                borderBottom: '1px solid',
                borderColor: 'greyscale.100',
                _last: { borderBottom: 'none' },
              })}
            >
              <div className={css({ flex: '1 1 14rem', minWidth: 0 })}>
                <div
                  className={css({ fontWeight: 600, overflowWrap: 'anywhere' })}
                >
                  {i.full_name || i.email}
                  {i.is_co_organizer && (
                    <span className={css({ marginLeft: '0.45rem' })}>
                      <Badge tone="info">Co-organisateur</Badge>
                    </span>
                  )}
                </div>
                <div
                  className={css({
                    color: 'greyscale.600',
                    fontSize: '0.8rem',
                  })}
                >
                  {i.full_name ? `${i.email} · ` : ''}
                  {i.has_account
                    ? 'compte actif'
                    : 'ne s’est encore jamais connecté'}
                </div>
              </div>
              {isOwner && (
                <Button
                  size="sm"
                  variant="tertiaryText"
                  onPress={() => toggle.mutate(i)}
                  isDisabled={toggle.isPending}
                >
                  {i.is_co_organizer
                    ? 'Retirer co-organisateur'
                    : 'Co-organisateur'}
                </Button>
              )}
              {(isOwner || !i.is_co_organizer) && (
                <Button
                  size="sm"
                  variant="tertiaryText"
                  square
                  aria-label={`Retirer ${i.email} de la liste`}
                  tooltip="Retirer de la liste"
                  onPress={() => remove.mutate(i)}
                  isDisabled={remove.isPending}
                >
                  <RiDeleteBinLine size={18} aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const InviteAllSection = ({ room }: { room: MyRoomDetail }) => {
  const [message, setMessage] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const send = useMutation({
    mutationFn: () => inviteAll(room.id, message.trim() || undefined),
    onSettled: () => setIsConfirming(false),
  })
  const count = room.invitees.length

  return (
    <section>
      <h3 className={sectionTitle}>Invitation</h3>
      {count === 0 ? (
        <p className={note}>
          Ajoutez des participants pour pouvoir leur envoyer le lien.
        </p>
      ) : (
        <>
          <Label
            htmlFor={`invite-message-${room.id}`}
            className={css({ fontSize: '0.875rem' })}
          >
            Message (facultatif)
          </Label>
          <TextArea
            id={`invite-message-${room.id}`}
            rows={2}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex. : séance du jeudi 10 h, pensez à préparer le chapitre 3."
            className={css({ marginTop: '0.25rem', marginBottom: '0.5rem' })}
          />
          {isConfirming ? (
            <div
              className={css({
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                flexWrap: 'wrap',
              })}
            >
              <span className={css({ fontSize: '0.9rem' })}>
                Envoyer le lien par email à {count} personne(s) ?
              </span>
              <Button
                variant="primary"
                size="sm"
                onPress={() => send.mutate()}
                isDisabled={send.isPending}
              >
                {send.isPending ? 'Envoi…' : 'Confirmer l’envoi'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setIsConfirming(false)}
              >
                Annuler
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onPress={() => setIsConfirming(true)}
            >
              <RiMailSendLine size={18} aria-hidden="true" />
              Envoyer l’invitation aux {count} participant(s)
            </Button>
          )}
          <div aria-live="polite">
            {send.isSuccess && (
              <p className={send.data.failed.length ? errorText : successText}>
                {send.data.sent} invitation(s) envoyée(s)
                {send.data.failed.length
                  ? ` · échec pour ${send.data.failed.join(', ')}`
                  : '.'}
              </p>
            )}
            {send.isError && (
              <p role="alert" className={errorText}>
                {errorMessage(
                  send.error,
                  'Les invitations n’ont pas pu être envoyées.'
                )}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
