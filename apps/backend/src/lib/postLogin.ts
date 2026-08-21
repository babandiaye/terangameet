/**
 * Where an authenticated user is sent once the OIDC dance finishes.
 *
 * Kept pure (base URL injected) so the redirect rules can be unit-tested
 * without standing up an identity provider.
 */

/**
 * Only ever redirect inside our own origin. `returnTo` arrives straight from the
 * query string, so without this guard an attacker could hand someone a login
 * link that drops them on an arbitrary site once authenticated (open redirect).
 */
export function safeReturnTo(returnTo: string, baseUrl: string): string {
  try {
    const url = new URL(returnTo, baseUrl)
    if (url.origin !== new URL(baseUrl).origin) return baseUrl
    return url.toString()
  } catch {
    return baseUrl
  }
}

/**
 * Signing in from the landing page drops the user straight into their personal
 * space — admins into the console — instead of back on the marketing page.
 *
 * Any other destination is preserved: returning to a room, a recording or a
 * legal page must not be hijacked. Callers must also skip this for silent
 * logins, which fire on whatever page the user is already reading.
 */
export function postLoginTarget(returnTo: string, baseUrl: string, isStaff: boolean): string {
  const safe = safeReturnTo(returnTo, baseUrl)
  if (new URL(safe, baseUrl).pathname !== '/') return safe
  return new URL(isStaff ? '/admin' : '/mon-espace', baseUrl).toString()
}
