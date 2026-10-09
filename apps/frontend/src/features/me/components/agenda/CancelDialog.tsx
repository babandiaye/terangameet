import { useMutation, useQueryClient } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { Button, Dialog } from '@/primitives'
import { cancelScheduledMeeting } from '../../api/meApi'
import type { ScheduledMeeting } from '../../api/types'
import { errorMessage } from '../roomAccessLevels'

export const CancelDialog = ({
  meeting,
  onClose,
}: {
  meeting: ScheduledMeeting | null
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const cancel = useMutation({
    mutationFn: (id: string) => cancelScheduledMeeting(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'schedule'] })
      onClose()
    },
  })

  return (
    <Dialog
      isOpen={!!meeting}
      onOpenChange={(open) => {
        if (!open) {
          cancel.reset()
          onClose()
        }
      }}
      role="alertdialog"
      title="Annuler cette réunion ?"
    >
      {meeting && (
        <div>
          <p className={css({ marginBottom: '1rem' })}>
            <strong>{meeting.title}</strong> — les {meeting.attendees.length}{' '}
            invité(s) recevront une annulation, et la réunion disparaîtra de
            leur agenda. La salle et son lien sont conservés.
          </p>
          {cancel.isError && (
            <p
              role="alert"
              className={css({ color: 'danger.600', marginBottom: '0.75rem' })}
            >
              {errorMessage(
                cancel.error,
                'La réunion n’a pas pu être annulée.'
              )}
            </p>
          )}
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
            })}
          >
            <Button
              variant="primary"
              onPress={() => cancel.mutate(meeting.id)}
              isDisabled={cancel.isPending}
            >
              {cancel.isPending ? 'Annulation…' : 'Annuler la réunion'}
            </Button>
            <Button variant="secondary" onPress={onClose}>
              Garder
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
