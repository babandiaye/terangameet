import { useMutation, UseMutationOptions } from '@tanstack/react-query'
import { fetchApi } from '@/api/fetchApi'
import type { ApiError } from '@/api/ApiError'
import type { ApiRoom } from './ApiRoom'

export interface CreateRoomParams {
  slug: string
  /** Meeting title shown to participants; the link stays `slug`. */
  name?: string
  callbackId?: string
  username?: string
}

const createRoom = ({
  slug,
  name,
  callbackId,
  username = '',
}: CreateRoomParams): Promise<ApiRoom> => {
  return fetchApi(`rooms/?username=${encodeURIComponent(username)}`, {
    method: 'POST',
    // Untitled meetings keep the historical contract — the slug doubles as the
    // name and the server derives the link from it — so a room opened from an
    // arbitrary URL is still accepted. A title travels with an explicit slug.
    body: JSON.stringify(
      name?.trim()
        ? { name: name.trim(), slug, callback_id: callbackId }
        : { name: slug, callback_id: callbackId }
    ),
  })
}

export function useCreateRoom(
  options?: UseMutationOptions<ApiRoom, ApiError, CreateRoomParams>
) {
  return useMutation<ApiRoom, ApiError, CreateRoomParams>({
    mutationFn: createRoom,
    onSuccess: options?.onSuccess,
  })
}
