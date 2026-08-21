import { RiStickyNoteLine } from '@remixicon/react'
import { ToggleButton } from '@/primitives'
import { useSidePanel } from '@/features/rooms/livekit/hooks/useSidePanel'

/** Opens the private notes side panel. Available to all participants. */
export const NotesToggle = () => {
  const { isNotesOpen, toggleNotes } = useSidePanel()
  return (
    <ToggleButton
      square
      variant="primaryDark"
      aria-label="Notes"
      tooltip="Notes"
      isSelected={isNotesOpen}
      onPress={toggleNotes}
    >
      <RiStickyNoteLine />
    </ToggleButton>
  )
}
