import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { keys } from '@/api/queryKeys'
import { useUser } from '@/features/auth/api/useUser'
import { authUrl } from '@/features/auth/utils/authUrl'
import { fetchRoom } from '../api/fetchRoom'
import { ApiAccessLevel } from '../api/ApiRoom'

/**
 * Trusted and restricted rooms take no one without a SENID account — not even
 * into the waiting room. Mirrors apps/backend/src/lib/roomAccess.ts.
 */
export const requiresLogin = (level?: ApiAccessLevel) =>
  level === ApiAccessLevel.TRUSTED || level === ApiAccessLevel.RESTRICTED

/** Off to SENID; the sign-in brings the person back to this meeting link. */
export const redirectToLogin = () => window.location.replace(authUrl())

/**
 * Sends a signed-out visitor of such a room to SENID as soon as they open the
 * link, rather than after they have typed a name. `isChecking` holds the join
 * screen until that is known, so it does not flash before the redirect.
 */
export const useSenidGate = (roomId: string) => {
  const { isLoggedIn } = useUser()
  const access = useQuery({
    queryKey: [keys.room, roomId, 'access'],
    queryFn: () => fetchRoom({ roomId }),
    enabled: isLoggedIn === false,
    retry: false,
    staleTime: Infinity,
  })
  const mustLogin =
    isLoggedIn === false &&
    !access.data?.livekit &&
    requiresLogin(access.data?.access_level)

  useEffect(() => {
    if (mustLogin) redirectToLogin()
  }, [mustLogin])

  return {
    isChecking:
      isLoggedIn === undefined ||
      (isLoggedIn === false && access.isPending) ||
      mustLogin,
  }
}
