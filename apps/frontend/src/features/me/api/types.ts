/** Payloads of the personal-space API (`/api/v1.0/me/...`). */

export interface Paginated<T> {
  count: number
  page: number
  page_size: number
  results: T[]
}

/** The caller's own attendance inside a given session. */
export interface MyAttendance {
  joined_at: string | null
  left_at: string | null
  duration_sec: number | null
}

export interface MyMeeting {
  id: string
  title: string
  room: { id: string; name: string; slug: string | null } | null
  started_at: string
  ended_at: string | null
  duration_sec: number | null
  participants: number
  has_recording: boolean
  is_active: boolean
  me: MyAttendance
}

export interface MyMeetingDetail extends Omit<MyMeeting, 'participants' | 'has_recording'> {
  participants: {
    id: string
    name: string
    is_me: boolean
    first_joined_at: string
    last_left_at: string | null
    duration_sec: number | null
    still_present: boolean
  }[]
  recordings: {
    id: string
    status: string
    mode: string
    created_at: string
  }[]
}

export interface MyRecording {
  id: string
  room: { id: string; name: string; slug: string | null } | null
  session: {
    id: string
    title: string
    started_at: string
    duration_sec: number | null
  } | null
  status: string
  mode: string
  is_owner: boolean
  created_at: string
  expired_at: string | null
  is_expired: boolean
}

export interface MyDashboard {
  user: { id: string; full_name: string; email: string; short_name: string }
  totals: {
    meetings: number
    total_duration_sec: number
    avg_duration_sec: number
    ongoing: number
    last_meeting_at: string | null
    recordings: number
  }
  recent_meetings: MyMeeting[]
}
