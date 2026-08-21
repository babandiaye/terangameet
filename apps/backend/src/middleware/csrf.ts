import type { Request, Response, NextFunction } from 'express'
import { randomBytes } from 'node:crypto'

const COOKIE = 'csrftoken'
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE'])

/** Paths that authenticate by their own signed token, exempt from CSRF. */
const EXEMPT_PREFIXES = [
  '/api/v1.0/rooms/webhooks-livekit',
  '/api/v1.0/recordings/storage-hook',
  '/external-api/',
  '/oidc/',
]

/**
 * Double-submit-cookie CSRF protection matching the frontend, which reads the
 * `csrftoken` cookie and echoes it in the `X-CSRFToken` header.
 */
export function csrf(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.[COOKIE]
  if (!token) {
    token = randomBytes(32).toString('hex')
    res.cookie(COOKIE, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    })
  }

  if (SAFE.has(req.method)) return next()
  if (EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) return next()

  const header = req.get('X-CSRFToken')
  if (!header || header !== token) {
    return res.status(403).json({ detail: 'CSRF verification failed.' })
  }
  next()
}
