import { useMutation } from '@tanstack/react-query'
import { Field } from '@/primitives'
import { updateRoom } from '../../api/meApi'
import type { MyRoomDetail, RoomAccessLevel } from '../../api/types'
import { ACCESS_LEVELS, errorMessage } from '../roomAccessLevels'
import { sectionTitle, errorText } from './styles'

export const AccessSection = ({
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
