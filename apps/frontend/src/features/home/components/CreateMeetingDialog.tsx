import { useTranslation } from 'react-i18next'
import { Dialog, Field, Form } from '@/primitives'
import { MEETING_TITLE_MAX } from '@/features/rooms/utils/meetingTitle'

export type CreateMeetingMode = 'instant' | 'later'

/**
 * Asks for an optional meeting title before the room is created. The link is
 * still a random code (ryf-lqxd-dtu); the title only helps people recognise the
 * meeting — in the room, in invitations and in the history.
 */
export const CreateMeetingDialog = ({
  mode,
  onClose,
  onCreate,
}: {
  mode: CreateMeetingMode | null
  onClose: () => void
  onCreate: (mode: CreateMeetingMode, name: string) => void
}) => {
  const { t } = useTranslation('home', { keyPrefix: 'createMeetingDialog' })

  return (
    <Dialog
      isOpen={!!mode}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title={t('heading')}
    >
      <Form
        onSubmit={(data) => {
          if (!mode) return
          onCreate(mode, String(data.name ?? '').trim())
          onClose()
        }}
        submitLabel={mode === 'later' ? t('submitLater') : t('submitInstant')}
        onCancelButtonPress={onClose}
      >
        {/* eslint-disable jsx-a11y/no-autofocus -- the field is the dialog's only purpose */}
        <Field
          type="text"
          name="name"
          autoFocus
          maxLength={MEETING_TITLE_MAX}
          label={t('nameLabel')}
          description={t('nameDescription')}
        />
      </Form>
    </Dialog>
  )
}
