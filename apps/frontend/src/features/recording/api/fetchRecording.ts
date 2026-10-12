import { fetchApi } from '@/api/fetchApi'
import type { ApiRoom } from '@/features/rooms/api/ApiRoom'
import type { RecordingMode, RecordingStatus } from '@/features/recording'

export type RecordingApi = {
  id: string
  // Optional on purpose: an older backend omitted it, which rendered
  // "undefined" in the page. Consumers must fall back gracefully.
  room?: Partial<Pick<ApiRoom, 'id' | 'name' | 'slug' | 'access_level'>> | null
  created_at: string
  key: string
  mode: RecordingMode
  status: RecordingStatus
  is_expired: boolean
  expired_at: string | null
}

export const fetchRecording = ({ recordingId }: { recordingId?: string }) => {
  return fetchApi<RecordingApi>(`/recordings/${recordingId}/`)
}
