import express from 'express'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { env } from './config/env'
import { sessionMiddleware } from './auth/session'
import { attachUser } from './auth/middleware'
import { livekitAuth } from './auth/livekit'
import { csrf } from './middleware/csrf'
import { configRouter } from './routes/config'
import { usersRouter } from './routes/users'
import { roomsRouter } from './routes/rooms'
import { roomModerationRouter } from './routes/roomModeration'
import { lobbyRouter } from './routes/lobby'
import { webhookRouter } from './routes/webhooks'
import { filesRouter } from './routes/files'
import { notesRouter } from './routes/notes'
import { inviteRouter } from './routes/invite'
import { recordingRoomRouter, recordingsRouter } from './routes/recording'
import { adminRouter } from './routes/admin'
import { meRouter } from './routes/me'
import { authRouter } from './routes/auth'
import { authLimiter, adminLimiter } from './middleware/rateLimit'
import { logger } from './lib/logger'

export function createApp() {
  const app = express()

  if (env.TRUST_PROXY) app.set('trust proxy', 1)

  app.use(
    helmet({
      contentSecurityPolicy: false, // the SPA + LiveKit need a permissive policy; handled at nginx
      crossOriginEmbedderPolicy: false,
    })
  )
  app.use(morgan(env.isProd ? 'combined' : 'dev'))
  app.use(
    express.json({
      limit: '2mb',
      // LiveKit posts webhooks as `application/webhook+json`; parse it too so the
      // raw body is captured and the signature checksum can be verified.
      type: ['application/json', 'application/webhook+json'],
      // Keep the raw body so LiveKit webhook signatures can be verified.
      verify: (req, _res, buf) => {
        ;(req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8')
      },
    })
  )
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())
  app.use(sessionMiddleware)
  app.use(attachUser)
  app.use(livekitAuth)
  app.use(csrf)

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }))

  // API
  const api = '/api/v1.0'
  app.use(`${api}/config`, configRouter)
  app.use(`${api}/users`, usersRouter)
  app.use(`${api}/files`, filesRouter)
  app.use(`${api}/recordings`, recordingsRouter)
  app.use(`${api}/admin`, adminLimiter, adminRouter)
  app.use(`${api}/me`, meRouter) // personal space: dashboard, history, recordings
  // Room sub-routers share the /rooms base; specific action paths are matched first.
  app.use(`${api}/rooms`, webhookRouter) // /webhooks-livekit/
  app.use(`${api}/rooms`, notesRouter) // /:id/notes/
  app.use(`${api}/rooms`, inviteRouter) // /:id/invite/
  app.use(`${api}/rooms`, recordingRoomRouter) // /:id/start-recording|stop-recording|start-subtitle
  app.use(`${api}/rooms`, roomModerationRouter) // /:id/toggle-hand|rename|mute|remove|update
  app.use(`${api}/rooms`, lobbyRouter) // /:id/request-entry|enter|waiting-participants
  app.use(`${api}/rooms`, roomsRouter) // create/get/update/delete
  app.use(`${api}/authenticate`, authLimiter) // throttle the OIDC entry point
  app.use(api, authRouter) // /authenticate/, /logout
  app.use('/oidc', authRouter) // /oidc/callback/

  // Serve the built frontend in production (single-app deployment).
  if (env.SERVE_FRONTEND) {
    const dist = path.isAbsolute(env.FRONTEND_DIST)
      ? env.FRONTEND_DIST
      : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', env.FRONTEND_DIST)
    if (fs.existsSync(dist)) {
      logger.info(`[app] serving frontend from ${dist}`)
      app.use(express.static(dist, { index: false }))
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/oidc')) return next()
        // A path carrying a file extension is an asset request, not an SPA route.
        // Without this, express.static missing a file fell through to index.html:
        // deleted assets still answered 200, and browsers asking for e.g.
        // /apple-touch-icon-precomposed.png were served HTML as an image.
        if (path.extname(req.path)) return next()
        res.sendFile(path.join(dist, 'index.html'))
      })
    } else {
      logger.warn(`[app] SERVE_FRONTEND set but dist not found at ${dist}`)
    }
  }

  // JSON 404 for unmatched API routes.
  app.use((req, res) => {
    res.status(404).json({ detail: 'Not found', path: req.path })
  })

  return app
}
