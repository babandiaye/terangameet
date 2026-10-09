import { useTranslation } from 'react-i18next'
import { MenuItem, Menu as RACMenu } from 'react-aria-components'
import { Button, Menu } from '@/primitives'
import { navigateTo } from '@/navigation/navigateTo'
import { generateRoomId, useCreateRoom } from '@/features/rooms'
import { RiAddLine, RiCalendarEventLine, RiLink } from '@remixicon/react'
import { useConfig } from '@/api/useConfig'
import { ScheduleMeetingDialog } from '@/features/me/components/ScheduleMeetingDialog'
import { LaterMeetingDialog } from '@/features/home/components/LaterMeetingDialog'
import {
  CreateMeetingDialog,
  type CreateMeetingMode,
} from '@/features/home/components/CreateMeetingDialog'
import { useState } from 'react'

import { menuRecipe } from '@/primitives/menuRecipe'
import { ApiRoom } from '@/features/rooms/api/ApiRoom'
import { loadUserChoices } from '@livekit/components-core'

export const CreateMeetingMenu = () => {
  // Only meaningful for guests: for a signed-in creator the server names the
  // participant from their account and ignores anything sent here.
  const { username } = loadUserChoices()

  const { t } = useTranslation('home')
  const { mutateAsync: createRoom } = useCreateRoom()
  const [laterRoom, setLaterRoom] = useState<null | ApiRoom>(null)
  const [isPlanning, setIsPlanning] = useState(false)
  const { data: config } = useConfig()
  const isCalendarEnabled = !!config?.calendar?.enabled
  // Both options first ask for an optional title, as Google Meet does when a
  // meeting is planned; the link itself is still a random code.
  const [pendingMode, setPendingMode] = useState<null | CreateMeetingMode>(null)

  const create = (mode: CreateMeetingMode, name: string) => {
    const slug = generateRoomId()
    const created = createRoom({ slug, name, username })
    if (mode === 'later') {
      created.then(setLaterRoom)
      return
    }
    created.then((data) =>
      navigateTo('room', data.slug, {
        state: { create: true, initialRoomData: data },
      })
    )
  }

  return (
    <>
      <Menu>
        <Button variant="primary" data-attr="create-meeting">
          {t('createMeeting')}
        </Button>
        <RACMenu>
          <MenuItem
            className={menuRecipe({ icon: true, variant: 'light' }).item}
            onAction={() => setPendingMode('instant')}
            data-attr="create-option-instant"
          >
            <RiAddLine size={18} />
            {t('createMenu.instantOption')}
          </MenuItem>
          <MenuItem
            className={menuRecipe({ icon: true, variant: 'light' }).item}
            // With the agenda on, « later » means planning it properly: date,
            // guests, co-hosts, calendar invitations. Off, the old flow stays —
            // switching the agenda off in the admin settings restores it.
            onAction={() =>
              isCalendarEnabled ? setIsPlanning(true) : setPendingMode('later')
            }
            data-attr="create-option-later"
          >
            {isCalendarEnabled ? (
              <RiCalendarEventLine size={18} />
            ) : (
              <RiLink size={18} />
            )}
            {isCalendarEnabled
              ? t('createMenu.planOption')
              : t('createMenu.laterOption')}
          </MenuItem>
        </RACMenu>
      </Menu>
      <ScheduleMeetingDialog
        isOpen={isPlanning}
        onClose={() => setIsPlanning(false)}
      />
      <CreateMeetingDialog
        mode={pendingMode}
        onClose={() => setPendingMode(null)}
        onCreate={create}
      />
      <LaterMeetingDialog
        room={laterRoom}
        onOpenChange={() => setLaterRoom(null)}
      />
    </>
  )
}
