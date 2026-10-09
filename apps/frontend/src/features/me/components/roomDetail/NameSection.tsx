import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { Button, Field } from '@/primitives'
import { updateRoom } from '../../api/meApi'
import type { MyRoomDetail } from '../../api/types'
import { errorMessage } from '../roomAccessLevels'
import { errorText, successText } from './styles'

export const NameSection = ({
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
