import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import { createApp } from './app'
import { env, validateEnv } from './config/env'
import { prisma } from './lib/prisma'
import { logger } from './lib/logger'
import { startPurgeScheduler } from './services/recordingPurge'
import { startGoogleSyncScheduler } from './services/googleSync'
import { startReconcileScheduler } from './services/livekitReconcile'

// Some upstreams (oauth2.googleapis.com) take ~300 ms to accept a TCP
// connection through the university firewall, past Node's 250 ms happy-eyeballs
// attempt; and this host has no IPv6 route, so the fallback fails at once and
// fetch() gives up on an address that was about to answer.
setDefaultAutoSelectFamilyAttemptTimeout(2000)

// Safety nets. A stray rejected promise (a fire-and-forget call, a timer) is
// logged, not fatal: Node 22 would otherwise stop the server and every meeting
// with it. An uncaught exception may leave the process in an unknown state, so
// it is logged and the process exits — systemd restarts it within seconds.
process.on('unhandledRejection', (reason) => {
  logger.error('[process] unhandled promise rejection', reason)
})
process.on('uncaughtException', (err) => {
  logger.error('[process] uncaught exception, exiting', err)
  process.exit(1)
})

async function main() {
  validateEnv() // fail fast on insecure/missing configuration (hard error in prod)
  const app = createApp()

  const server = app.listen(env.PORT, env.BIND_HOST, () => {
    logger.info(
      `[server] TerangaMeet backend listening on ${env.BIND_HOST}:${env.PORT} (${env.NODE_ENV})`
    )
  })

  const stopPurge = startPurgeScheduler()
  const stopGoogleSync = startGoogleSyncScheduler()
  const stopReconcile = startReconcileScheduler()

  const shutdown = async (signal: string) => {
    logger.info(`[server] ${signal} received, shutting down`)
    stopPurge()
    stopGoogleSync()
    stopReconcile()
    server.close()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  logger.error('[server] fatal', err)
  process.exit(1)
})
