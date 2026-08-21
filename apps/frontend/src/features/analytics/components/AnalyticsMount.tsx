import { useAnalyticsTracker } from '../useAnalyticsTracker'
import { AnalyticsDashboard } from './AnalyticsDashboard'

/**
 * Mount once inside the room: runs the analytics tracker continuously and renders
 * the dashboard modal (which only shows when opened).
 */
export const AnalyticsMount = () => {
  useAnalyticsTracker()
  return <AnalyticsDashboard />
}
