import { RiLineChartLine } from '@remixicon/react'
import { useSnapshot } from 'valtio'
import { ToggleButton } from '@/primitives'
import { useIsAdminOrOwner } from '@/features/rooms/livekit/hooks/useIsAdminOrOwner'
import { analyticsStore } from '../store'

/** Opens the real-time meeting dashboard. Visible to room admins/owners only. */
export const DashboardToggle = () => {
  const isAdmin = useIsAdminOrOwner()
  const snap = useSnapshot(analyticsStore)
  if (!isAdmin) return null
  return (
    <ToggleButton
      square
      variant="primaryDark"
      aria-label="Tableau de bord"
      tooltip="Tableau de bord"
      isSelected={snap.isOpen}
      onPress={() => {
        analyticsStore.isOpen = !analyticsStore.isOpen
      }}
    >
      <RiLineChartLine />
    </ToggleButton>
  )
}
