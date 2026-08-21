import session from 'express-session'
import RedisStore from 'connect-redis'
import { redis } from '../lib/redis'
import { env } from '../config/env'

const store = new RedisStore({ client: redis, prefix: 'tmsess:' })

export const sessionMiddleware = session({
  store,
  name: env.SESSION_COOKIE_NAME,
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: env.SESSION_COOKIE_AGE_S * 1000,
  },
})

// Augment the session shape with our fields.
declare module 'express-session' {
  interface SessionData {
    userId?: string
    anonId?: string
    idToken?: string
    /** Per-room lobby participant id for guests awaiting entry. */
    lobby?: Record<string, string>
    oidc?: {
      codeVerifier?: string
      state: string
      nonce?: string
      returnTo: string
      silent: boolean
    }
  }
}
