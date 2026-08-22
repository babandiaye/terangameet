export interface AdminUserBrief {
  id: string
  full_name: string
  email: string
  short_name: string
}

export interface AdminStats {
  totals: {
    users: number
    active_users: number
    admins: number
    rooms: number
    sessions: number
    active_sessions: number
    recordings: number
    total_duration_sec: number
    avg_duration_sec: number
    finished_sessions: number
  }
  meetings_per_week: { bucket: string; count: number }[]
  meetings_per_month: { bucket: string; count: number }[]
  top_creators: {
    user: AdminUserBrief | null
    meetings: number
    total_duration_sec: number
  }[]
}

export interface AdminUserRow extends AdminUserBrief {
  is_admin: boolean
  is_active: boolean
  created_at: string
  meetings_created: number
  rooms: number
}

export interface AdminUserDetail extends AdminUserRow {
  language: string
  timezone: string
  recent_sessions: {
    id: string
    title: string
    started_at: string
    ended_at: string | null
    duration_sec: number | null
    max_participants: number
  }[]
}

export interface AdminMeeting {
  id: string
  title: string
  room: { id: string; name: string; slug: string | null } | null
  creator: AdminUserBrief | null
  started_at: string
  ended_at: string | null
  duration_sec: number | null
  max_participants: number
  total_joins: number
  is_active: boolean
}

export interface AdminRecording {
  id: string
  room: { id: string; name: string } | null
  creator: AdminUserBrief | null
  status: string
  mode: string
  created_at: string
  expired_at: string | null
}

export interface Paginated<T> {
  count: number
  page: number
  page_size: number
  results: T[]
}

/**
 * Chart windows. Each keeps its own bucket size — d7 and d30 are both daily,
 * so naming these by bucket ('day') could not tell them apart.
 */
export type SeriesRange = 'h24' | 'd7' | 'd30' | 'm12'

export interface SeriesPoint {
  bucket: string
  count: number
}

export interface DashboardMeeting {
  id: string
  title: string
  room: { id: string; name: string } | null
  creator: AdminUserBrief | null
  started_at: string
  ended_at: string | null
  duration_sec: number | null
  max_participants: number
  is_active: boolean
}

export interface ActivityItem {
  id: string
  type: string
  title: string
  subtitle: string
  at: string
}

export interface AdminDashboard {
  totals: {
    sessions: number
    active_sessions: number
    users: number
    rooms: number
    recordings: number
    total_duration_sec: number
  }
  /** Connected right now, recording bots excluded. */
  live: {
    participants: number
    meetings: number
  }
  trends: {
    sessions_pct: number
    active_users_pct: number
    rooms_pct: number
    recordings_pct: number
  }
  series: {
    meetings: Record<SeriesRange, SeriesPoint[]>
    active_users: Record<SeriesRange, SeriesPoint[]>
  }
  recent_meetings: DashboardMeeting[]
  recent_activity: ActivityItem[]
}

export interface ParticipantAttendance {
  id: string
  identity: string
  name: string
  first_joined_at: string
  last_left_at: string | null
  duration_sec: number | null
  still_present: boolean
}

export interface AdminMeetingDetail extends AdminMeeting {
  participants: ParticipantAttendance[]
}

export interface PurgeConfig {
  enabled: boolean
  period?: string
  periods?: string[]
  eligible_count?: number
}

export type HealthStatus = 'ok' | 'down' | 'disabled' | 'unknown'

export interface ComponentHealth {
  key: string
  label: string
  status: HealthStatus
  latencyMs: number | null
  detail: string
}

export interface StatusReport {
  checkedAt: string
  components: ComponentHealth[]
}

export interface AdminRoom {
  id: string
  name: string
  slug: string | null
  access_level: string
  created_at: string
  owner: AdminUserBrief | null
  sessions: number
  recordings: number
}
