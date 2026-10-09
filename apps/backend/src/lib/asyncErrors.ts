import { createRequire } from 'node:module'
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express'
import { logger } from './logger'

/**
 * Express 4 predates async functions: when an `async` route throws (Postgres
 * restarting, Redis unreachable, LiveKit timing out), the rejected promise
 * escapes Express, and Node 22 stops the whole process on an unhandled
 * rejection — every meeting in progress loses the API until systemd restarts
 * it. Express 5 handles this natively; until we move to it, this does the
 * same, in one place rather than in each of the routes.
 *
 * It wraps the single function through which Express 4 calls every route and
 * middleware (Layer#handle_request), the approach of the well-known
 * `express-async-errors` package: a returned promise that rejects is passed to
 * next(err), like a synchronous throw already is. Error middlewares (four
 * arguments) go through a different path and are left alone.
 */
type LayerLike = {
  handle: (req: Request, res: Response, next: NextFunction) => unknown
  handle_request: (req: Request, res: Response, next: NextFunction) => void
}

let installed = false

export function installAsyncErrorHandling(): void {
  if (installed) return
  installed = true
  // The same copy of Express the app uses (resolved from here, not bundled).
  const Layer = createRequire(import.meta.url)('express/lib/router/layer.js') as {
    prototype: LayerLike
  }
  Layer.prototype.handle_request = function handleRequest(this: LayerLike, req, res, next) {
    const fn = this.handle
    if (fn.length > 3) return next()
    try {
      const result = fn(req, res, next) as { catch?: (cb: (err: unknown) => void) => void } | undefined
      if (result && typeof result.catch === 'function') result.catch((err) => next(err ?? new Error('Rejected')))
    } catch (err) {
      next(err)
    }
  }
}

/**
 * Last middleware of the app: an error that reached it becomes a JSON 500,
 * logged with the request it broke. If the response had already started,
 * Express's own handler closes the connection — nothing better is possible.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    logger.error(`[http] ${req.method} ${req.originalUrl} failed mid-response`, err)
    return next(err)
  }
  // A client error that already carries its status (malformed JSON, body too
  // large — raised by body-parser) keeps it: it is the caller's fault, not ours.
  const status = Number((err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode)
  if (status >= 400 && status < 500) {
    logger.debug(`[http] ${req.method} ${req.originalUrl} → ${status}: ${(err as Error).message}`)
    return res.status(status).json({ detail: 'Requête invalide.' })
  }
  logger.error(`[http] ${req.method} ${req.originalUrl} failed`, err)
  res.status(500).json({ detail: 'Erreur interne du serveur. Réessayez dans un instant.' })
}
