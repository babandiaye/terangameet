import { useQuery, useQueryClient } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { Dialog } from '@/primitives'
import { RoomLink } from '@/components/console/RoomLink'
import { fetchMyRoom } from '../api/meApi'
import type { MyRoomDetail, RoomInvitee } from '../api/types'
import { note, errorText } from './roomDetail/styles'
import { NameSection } from './roomDetail/NameSection'
import { AccessSection } from './roomDetail/AccessSection'
import { InviteesSection } from './roomDetail/InviteesSection'
import { InviteAllSection } from './roomDetail/InviteAllSection'

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
