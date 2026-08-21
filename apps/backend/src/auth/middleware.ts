import type { Request, Response, NextFunction } from 'express'
import type { User } from '@prisma/client'
import { prisma } from '../lib/prisma'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User | null
    }
  }
}

/** Loads the session user (if any) onto req.user. Never blocks. */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const userId = req.session?.userId
  if (userId) {
    try {
      req.user = await prisma.user.findUnique({ where: { id: userId } })
    } catch {
      req.user = null
    }
  }
  next()
}

/** Requires an authenticated user; 401 otherwise. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ detail: 'Authentication required.' })
  }
  next()
}

/** Requires a platform administrator (User.isStaff); 401/403 otherwise. */
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ detail: 'Authentication required.' })
  }
  if (!req.user.isStaff) {
    return res.status(403).json({ detail: 'Administrator privileges required.' })
  }
  next()
}

/** Public-facing user serialization expected by the frontend (ApiUser). */
export function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email ?? '',
    full_name: user.fullName ?? '',
    short_name: user.shortName ?? '',
    last_name: user.shortName ?? '',
    language: user.language,
    timezone: user.timezone,
    is_admin: user.isStaff,
  }
}
