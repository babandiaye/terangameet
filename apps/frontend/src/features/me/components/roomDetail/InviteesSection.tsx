import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { RiDeleteBinLine } from '@remixicon/react'
import { Button, Field } from '@/primitives'
import { Badge } from '@/components/console/ui'
import {
  addInvitees,
  removeInvitee,
  searchPeople,
  setCoOrganizer,
} from '../../api/meApi'
import type { MyRoomDetail, RoomInvitee } from '../../api/types'
import { errorMessage } from '../roomAccessLevels'
import { InviteePicker } from '../InviteePicker'
import { sectionTitle, note, errorText, successText } from './styles'

export const InviteesSection = ({
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
          ? 'Ces personnes entrent sans attendre en se connectant avec SENID sous cette adresse ; les autres passent par la salle d’attente.'
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
