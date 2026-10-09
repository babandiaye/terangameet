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

/* ---------------------------------------------------------------- rooms -- */

export type RoomAccessLevel = 'public' | 'trusted' | 'restricted'

/** A room the user organises (owner, or co-organizer by the participant list). */
export interface MyRoom {
  id: string
  name: string
  slug: string
  url: string
  access_level: RoomAccessLevel
  my_role: 'owner' | 'co_organizer'
  invitees_count: number
  sessions_count: number
  last_session_at: string | null
  is_active: boolean
  created_at: string
}

export interface RoomInvitee {
  id: string
  email: string
  is_co_organizer: boolean
  /** Has signed in at least once with this address. */
  has_account: boolean
  full_name: string | null
  created_at: string
}

export interface MyRoomDetail {
  id: string
  name: string
  slug: string
  url: string
  access_level: RoomAccessLevel
  /** 'admin': a platform administrator editing someone else's room. */
  my_role: 'owner' | 'co_organizer' | 'admin'
  owner: { full_name: string | null; email: string | null } | null
  invitees: RoomInvitee[]
  max_invitees: number
  email_enabled: boolean
}

export interface AddInviteesResult {
  added: string[]
  already_listed: string[]
  invalid: string[]
  invitees: RoomInvitee[]
}

/* --------------------------------------------------------------- agenda -- */

export interface ScheduledAttendee {
  email: string
  full_name: string | null
  response: 'needs_action' | 'accepted' | 'declined' | 'tentative'
  is_me: boolean
  /** Co-organizer of the meeting's room. */
  is_co_host: boolean
}

export interface ScheduledMeeting {
  id: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  timezone: string
  status: 'scheduled' | 'cancelled'
  room: { id: string; name: string; slug: string; url: string }
  organizer: { full_name: string | null; email: string | null }
  is_organizer: boolean
  /** Only the room's owner may name co-hosts. */
  can_manage_co_hosts: boolean
  /** Where the invitations live: the organiser's Google Calendar, or email. */
  channel: 'google' | 'email'
  attendees: ScheduledAttendee[]
}

export interface MailReport {
  sent: number
  failed: string[]
  via: 'google' | 'email'
}

export interface GoogleLink {
  available: boolean
  connected: boolean
  google_email: string | null
  connected_at: string | null
}

export interface ScheduleInput {
  title: string
  description: string
  starts_at: string
  ends_at: string
  /** Omitted on creation → a new room titled like the meeting. */
  room_id?: string
  /** Access type of a new room. */
  access_level?: RoomAccessLevel
  attendees: string[]
  /** Guests who co-host (made co-organizers of the room). */
  co_hosts?: string[]
}
