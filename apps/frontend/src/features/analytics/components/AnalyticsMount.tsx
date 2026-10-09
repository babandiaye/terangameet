import { useSnapshot } from 'valtio'
import { useIsAdminOrOwner } from '@/features/rooms/livekit/hooks/useIsAdminOrOwner'
import { useAnalyticsTracker } from '../useAnalyticsTracker'
import { analyticsStore } from '../store'
import { AnalyticsDashboard } from './AnalyticsDashboard'

/**
 * Mount once inside the room. Only moderators can open the dashboard, so only
 * they run the tracker; and the dashboard itself — which follows a clock that
 * ticks every second — exists only while it is open. Before, every participant
 * re-rendered it each second, closed, for the whole meeting.
 *
 * A co-host promoted mid-meeting starts collecting from their promotion on.
 */
export const AnalyticsMount = () => {
  const isModerator = useIsAdminOrOwner()
  return isModerator ? <ModeratorAnalytics /> : null
}

const ModeratorAnalytics = () => {
  useAnalyticsTracker()
  const { isOpen } = useSnapshot(analyticsStore)
  return isOpen ? <AnalyticsDashboard /> : null
}
