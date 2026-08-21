import { fetchApi } from '@/api/fetchApi'

export const fetchNotes = (roomId: string) =>
  fetchApi<{ content: string; updated_at: string | null }>(`/rooms/${roomId}/notes/`)

export const saveNotes = (roomId: string, content: string) =>
  fetchApi<{ content: string; updated_at: string }>(`/rooms/${roomId}/notes/`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
