import { fetchApi } from '@/api/fetchApi'
import type {
  AdminStats,
  AdminDashboard,
  AdminUserRow,
  AdminUserDetail,
  AdminMeeting,
  AdminMeetingDetail,
  AdminRecording,
  AdminRoom,
  StatusReport,
  PurgeConfig,
  Paginated,
} from './types'

const qs = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const fetchAdminStats = () => fetchApi<AdminStats>('/admin/stats/')

export const fetchAdminDashboard = () => fetchApi<AdminDashboard>('/admin/dashboard/')

export const fetchAdminRooms = (params: {
  page?: number
  search?: string
  sort?: string
  order?: string
}) => fetchApi<Paginated<AdminRoom>>(`/admin/rooms/${qs(params)}`)

export const fetchAdminStatus = () => fetchApi<StatusReport>('/admin/status/')

export const fetchPurgeConfig = () => fetchApi<PurgeConfig>('/admin/purge/')

export const setPurgePeriod = (period: string) =>
  fetchApi<PurgeConfig>('/admin/purge/', { method: 'PUT', body: JSON.stringify({ period }) })

export const runPurge = () =>
  fetchApi<{ deleted: number; period: string; eligible_count: number }>('/admin/purge/run/', {
    method: 'POST',
  })

export const fetchAdminUsers = (params: { page?: number; search?: string }) =>
  fetchApi<Paginated<AdminUserRow>>(`/admin/users/${qs(params)}`)

export const fetchAdminUser = (id: string) => fetchApi<AdminUserDetail>(`/admin/users/${id}/`)

export const patchAdminUser = (id: string, body: { is_active?: boolean; is_admin?: boolean }) =>
  fetchApi<AdminUserRow>(`/admin/users/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const fetchAdminMeetings = (params: {
  page?: number
  creatorId?: string
  from?: string
  to?: string
  active?: string
}) => fetchApi<Paginated<AdminMeeting>>(`/admin/meetings/${qs(params)}`)

export const fetchAdminMeeting = (id: string) =>
  fetchApi<AdminMeetingDetail>(`/admin/meetings/${id}/`)

export const fetchAdminRecordings = (params: { page?: number; sort?: string; order?: string }) =>
  fetchApi<Paginated<AdminRecording>>(`/admin/recordings/${qs(params)}`)
