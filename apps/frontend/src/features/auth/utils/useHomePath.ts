import { useUser } from '@/features/auth/api/useUser'

/**
 * Where "home" points for the current visitor.
 *
 * The landing page is for anonymous visitors only: once signed in, a user's home
 * is their own space (the console for platform administrators). Every logo and
 * "back home" link goes through this hook so no path sends a signed-in user back
 * to the marketing page — Home itself redirects them away, and linking straight
 * to the right destination avoids that extra hop.
 */
export const useHomePath = (): string => {
  const { user, isLoggedIn } = useUser()
  if (!isLoggedIn) return '/'
  return user?.is_admin ? '/admin' : '/mon-espace'
}
