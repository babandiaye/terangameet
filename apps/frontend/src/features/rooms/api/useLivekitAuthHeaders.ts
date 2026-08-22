import { useRoomData } from '../livekit/hooks/useRoomData'

/**
 * Authorization header carrying the LiveKit token, for the moderation endpoints.
 *
 * The server accepts three standings: the admin grant inside this token, a
 * persisted room role read from the session cookie, or a co-host promoted for
 * the current session. That last one is held on the LiveKit participant, so the
 * server can only look it up if it knows which participant is calling — and the
 * token is the only thing that says so. Without this header a co-host is
 * indistinguishable from any other participant, and every moderation call they
 * make comes back 403.
 */
export const useLivekitAuthHeaders = (): Record<string, string> | undefined => {
  const data = useRoomData()
  const token = data?.livekit?.token
  return token ? { Authorization: `Bearer ${token}` } : undefined
}
