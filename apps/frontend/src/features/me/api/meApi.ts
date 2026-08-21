import { fetchApi } from '@/api/fetchApi'
import type {
  MyDashboard,
  MyMeeting,
  MyMeetingDetail,
  MyRecording,
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

export const fetchMyDashboard = () => fetchApi<MyDashboard>('/me/dashboard/')

export const fetchMyMeetings = (params: { page?: number; active?: string }) =>
  fetchApi<Paginated<MyMeeting>>(`/me/meetings/${qs(params)}`)

export const fetchMyMeeting = (id: string) => fetchApi<MyMeetingDetail>(`/me/meetings/${id}/`)

export const fetchMyRecordings = (params: { page?: number }) =>
  fetchApi<Paginated<MyRecording>>(`/me/recordings/${qs(params)}`)
