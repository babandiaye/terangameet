import { fetchApi } from '@/api/fetchApi'
import type {
  AddInviteesResult,
  MyDashboard,
  MyMeeting,
  MyMeetingDetail,
  MyRecording,
  MyRoom,
  MyRoomDetail,
  Paginated,
  RoomAccessLevel,
  RoomInvitee,
} from './types'

const qs = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const fetchMyDashboard = () => fetchApi<MyDashboard>('/me/dashboard/')

export const fetchMyMeetings = (params: { page?: number; active?: string }) =>
  fetchApi<Paginated<MyMeeting>>(`/me/meetings/${qs(params)}`)

export const fetchMyMeeting = (id: string) => fetchApi<MyMeetingDetail>(`/me/meetings/${id}/`)

export const fetchMyRecordings = (params: { page?: number }) =>
  fetchApi<Paginated<MyRecording>>(`/me/recordings/${qs(params)}`)

/* ---------------------------------------------------------------- rooms -- */

export const fetchMyRooms = (params: { page?: number }) =>
  fetchApi<Paginated<MyRoom>>(`/me/rooms/${qs(params)}`)

export const fetchMyRoom = (id: string) => fetchApi<MyRoomDetail>(`/me/rooms/${id}/`)

export const createMyRoom = (body: { name: string; access_level: RoomAccessLevel }) =>
  fetchApi<{ id: string; slug: string; name: string }>('/me/rooms/', {
    method: 'POST',
    body: JSON.stringify(body),
  })

/** Name and access type go through PATCH /rooms/:id, which also tells a running session. */
export const updateRoom = (id: string, body: { name?: string; access_level?: RoomAccessLevel }) =>
  fetchApi(`/rooms/${id}/`, { method: 'PATCH', body: JSON.stringify(body) })

export const addInvitees = (id: string, body: { emails: string; is_co_organizer: boolean }) =>
  fetchApi<AddInviteesResult>(`/me/rooms/${id}/invitees/`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const setCoOrganizer = (id: string, inviteeId: string, isCoOrganizer: boolean) =>
  fetchApi<{ invitees: RoomInvitee[] }>(`/me/rooms/${id}/invitees/${inviteeId}/`, {
    method: 'PATCH',
    body: JSON.stringify({ is_co_organizer: isCoOrganizer }),
  })

export const removeInvitee = (id: string, inviteeId: string) =>
  fetchApi<{ invitees: RoomInvitee[] }>(`/me/rooms/${id}/invitees/${inviteeId}/`, {
    method: 'DELETE',
  })

export const inviteAll = (id: string, message?: string) =>
  fetchApi<{ sent: number; failed: string[] }>(`/me/rooms/${id}/invite-all/`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })

/** Members of the platform matching a name or address, for the participant picker. */
export const searchPeople = (roomId: string, q: string) =>
  fetchApi<{ results: { id: string; full_name: string | null; email: string }[] }>(
    `/me/rooms/${roomId}/people/${qs({ q })}`
  )
