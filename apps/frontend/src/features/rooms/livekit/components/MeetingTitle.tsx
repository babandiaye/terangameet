import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'wouter'
import { RiPencilLine } from '@remixicon/react'
import { css } from '@/styled-system/css'
import { HStack } from '@/styled-system/jsx'
import { Button, Field, Form, Text } from '@/primitives'
import { keys } from '@/api/queryKeys'
import { queryClient } from '@/api/queryClient'
import { usePatchRoom } from '@/features/rooms/api/patchRoom'
import type { ApiRoom } from '@/features/rooms/api/ApiRoom'
import { MEETING_TITLE_MAX } from '@/features/rooms/utils/meetingTitle'
import { useMeetingTitle } from '../hooks/useMeetingTitle'

/**
 * Title block of the meeting details panel. The room owner (and its persisted
 * admins — the server refuses everyone else) can rename it in place; the link
 * does not change.
 */
export const MeetingTitle = () => {
  const { t } = useTranslation('rooms', { keyPrefix: 'info.meetingTitle' })
  const { roomId } = useParams()
  const { room, title } = useMeetingTitle()
  const [isEditing, setIsEditing] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)
  const { mutateAsync: patchRoom, isPending } = usePatchRoom()

  // Renaming goes through PATCH /rooms, which checks the persisted room role;
  // a session co-host would only be refused, so they get no pencil.
  const canRename = !!room?.is_administrable

  const save = async (name: string) => {
    if (!room) return
    if (!name || name === room.name) {
      setIsEditing(false)
      return
    }
    setHasFailed(false)
    try {
      const updated = await patchRoom({ roomId: room.id, room: { name } })
      // Merge: the PATCH answer carries no LiveKit token, and the call needs it.
      queryClient.setQueryData<ApiRoom>([keys.room, roomId], (old) =>
        old ? { ...old, name: updated.name } : old
      )
      setIsEditing(false)
    } catch {
      setHasFailed(true)
    }
  }

  if (isEditing) {
    return (
      <Form
        className={css({ width: '100%', marginBottom: '0.5rem' })}
        onSubmit={(data) => save(String(data.name ?? '').trim())}
        submitLabel={t('save')}
        submitButtonProps={{ size: 'sm', isDisabled: isPending }}
        onCancelButtonPress={() => {
          setHasFailed(false)
          setIsEditing(false)
        }}
      >
        {/* eslint-disable jsx-a11y/no-autofocus -- the user just asked to edit this field */}
        <Field
          type="text"
          name="name"
          autoFocus
          defaultValue={title ?? ''}
          maxLength={MEETING_TITLE_MAX}
          label={t('label')}
          description={hasFailed ? t('error') : undefined}
          wrapperProps={{ fullWidth: true }}
        />
      </Form>
    )
  }

  if (!title && !canRename) return null

  return (
    <HStack
      gap="0.25rem"
      alignItems="start"
      className={css({ width: '100%', marginBottom: '0.5rem' })}
    >
      <Text
        as="h2"
        variant="h3"
        wrap="pretty"
        className={css({
          flex: 1,
          minWidth: 0,
          overflowWrap: 'anywhere',
          color: title ? undefined : 'greyscale.500',
        })}
      >
        {title ?? t('untitled')}
      </Text>
      {canRename && (
        <Button
          size="sm"
          variant="tertiaryText"
          square
          aria-label={t('rename')}
          tooltip={t('rename')}
          onPress={() => setIsEditing(true)}
        >
          <RiPencilLine size={18} aria-hidden="true" />
        </Button>
      )}
    </HStack>
  )
}
