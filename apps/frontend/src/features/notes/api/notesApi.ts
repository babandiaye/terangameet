import { fetchApi } from '@/api/fetchApi'

export const fetchNotes = (roomId: string) =>
  fetchApi<{ content: string; updated_at: string | null }>(`/rooms/${roomId}/notes/`)

/**
 * `keepalive` lets the request finish after the page is gone: the last words
 * typed are saved even when the participant leaves or closes the tab.
 */
export const saveNotes = (roomId: string, content: string, opts: { keepalive?: boolean } = {}) =>
  fetchApi<{ content: string; updated_at: string }>(`/rooms/${roomId}/notes/`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
    keepalive: opts.keepalive,
  })
