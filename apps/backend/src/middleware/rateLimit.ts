import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import type { Request, Response } from 'express'

const tooMany = (_req: Request, res: Response) =>
  res.status(429).json({ detail: 'Trop de requêtes, réessayez dans un instant.' })

/**
 * Login throttle: protects the OIDC entry point from brute-force / redirect abuse.
 * Keyed by client IP (nginx sets X-Forwarded-For; trust proxy is enabled in prod).
 */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany,
})

/**
 * Admin API throttle: guards the (sometimes heavy) admin endpoints. Keyed by the
 * authenticated user when available, falling back to IP — so several admins behind
 * the same campus NAT don't share a budget. Generous enough for the 10s status poll.
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? ''),
  handler: tooMany,
})

/**
 * Email-invite throttle: caps outbound invitation emails to curb spam/abuse.
 * Keyed by the authenticated user (each invite request may fan out to several
 * recipients, so the window is deliberately small).
 */
export const inviteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? ''),
  handler: tooMany,
})
