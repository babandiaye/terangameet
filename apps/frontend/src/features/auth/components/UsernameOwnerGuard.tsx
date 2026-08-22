import { useEffect } from 'react'
import { useUser } from '../api/useUser'
import { reconcileUsernameOwner } from '@/stores/userChoices'

/**
 * Keeps the persisted display name tied to the account that chose it.
 *
 * Without this, signing in on a browser somebody else used means joining
 * meetings — and appearing in attendance sheets — under their name.
 */
export const UsernameOwnerGuard = () => {
  const { user, isLoggedIn } = useUser()

  useEffect(() => {
    // undefined means the session is still being resolved; acting now would
    // reset the name of the very user we are about to identify.
    if (isLoggedIn === undefined) return
    reconcileUsernameOwner(
      user?.id ?? null,
      user?.full_name || user?.email || ''
    )
  }, [isLoggedIn, user?.id, user?.full_name, user?.email])

  return null
}
