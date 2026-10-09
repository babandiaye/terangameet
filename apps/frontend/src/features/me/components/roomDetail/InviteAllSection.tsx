import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Label } from 'react-aria-components'
import { css } from '@/styled-system/css'
import { RiMailSendLine } from '@remixicon/react'
import { Button, TextArea } from '@/primitives'
import { inviteAll } from '../../api/meApi'
import type { MyRoomDetail } from '../../api/types'
import { errorMessage } from '../roomAccessLevels'
import { sectionTitle, note, errorText, successText } from './styles'

export const InviteAllSection = ({ room }: { room: MyRoomDetail }) => {
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
